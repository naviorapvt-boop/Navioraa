import type { Request, Response } from 'express';

interface InMemEnquiry {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  programOrService: string;
  message: string;
  status: string;
  createdAt: string;
  emailNotificationSent: boolean;
}

// In-memory cache for serverless invocation
const serverlessEnquiries: InMemEnquiry[] = [];

export default async function handler(req: Request, res: Response) {
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      enquiries: serverlessEnquiries,
    });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string || (req.body && req.body.id);
    if (id) {
      const idx = serverlessEnquiries.findIndex(e => e.id === id);
      if (idx !== -1) {
        serverlessEnquiries.splice(idx, 1);
      }
    }
    return res.status(200).json({ success: true, deleted: true });
  }

  if (req.method === 'PATCH') {
    const id = req.query.id as string || (req.body && req.body.id);
    const updates = req.body || {};
    if (id) {
      const enq = serverlessEnquiries.find(e => e.id === id);
      if (enq) {
        Object.assign(enq, updates);
      }
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST') {
    const { fullName, email, phone, programOrService, message, enquiryId } = req.body || {};

    if (!fullName || !email || !phone || !programOrService || !message) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    const resendApiKey = process.env.RESEND_API_KEY || '';
    const recipient = process.env.NOTIFICATION_RECIPIENT || 'support@navioraa.com';
    const emailFrom = process.env.EMAIL_FROM || 'NAVIORAA Admissions <onboarding@resend.dev>';

    const record: InMemEnquiry = {
      id: enquiryId || `enq_${Date.now()}`,
      fullName: String(fullName).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      programOrService: String(programOrService).trim(),
      message: String(message).trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
      emailNotificationSent: false,
    };

    let emailDelivered = false;
    let emailStatusNote = 'Stored in Inquiry Queue';

    if (resendApiKey) {
      try {
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
            <h2 style="color: #0052FF; margin-top: 0;">New Admissions Inquiry: ${record.fullName}</h2>
            <p><strong>Program / Track:</strong> ${record.programOrService}</p>
            <p><strong>Applicant Email:</strong> <a href="mailto:${record.email}">${record.email}</a></p>
            <p><strong>Phone / WhatsApp:</strong> <a href="https://wa.me/${record.phone.replace(/[^0-9]/g, '')}">${record.phone}</a></p>
            <div style="background-color: #F8FAFC; padding: 12px; border-radius: 6px; border-left: 3px solid #0052FF; margin: 16px 0;">
              ${record.message.replace(/\n/g, '<br/>')}
            </div>
            <p style="color: #64748B; font-size: 11px;">Generated from NAVIORAA Website Enquiry Form.</p>
          </div>
        `;

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [recipient],
            reply_to: record.email,
            subject: `New Admissions Inquiry: ${record.fullName} - ${record.programOrService}`,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailDelivered = true;
          record.emailNotificationSent = true;
          emailStatusNote = `Notification successfully delivered to ${recipient}`;
        } else {
          const errorData = await resendRes.json().catch(() => ({}));
          emailStatusNote = errorData.message || `Resend HTTP ${resendRes.status}`;
        }
      } catch (err) {
        emailStatusNote = err instanceof Error ? err.message : String(err);
      }
    }

    serverlessEnquiries.unshift(record);

    return res.status(200).json({
      success: true,
      emailDelivered,
      emailMessage: emailStatusNote,
      enquiryId: record.id,
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
