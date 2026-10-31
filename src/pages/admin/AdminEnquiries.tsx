import React, { useState, useEffect } from 'react';
import { getEnquiries, updateEnquiryStatus, deleteEnquiry } from '../../lib/data-service';
import { Enquiry, EnquiryStatus } from '../../lib/types';
import { useAuth } from '../../lib/auth-context';

export const AdminEnquiries: React.FC = () => {
  const { isOwner, isAdmin } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state for detail sidebar
  const [activeStatus, setActiveStatus] = useState<EnquiryStatus>('new');
  const [assignedTo, setAssignedTo] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // In-app deletion state (never blocked by iframe sandbox)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAllEnquiries = async () => {
    try {
      const data = await getEnquiries();
      setEnquiries(data);
      if (selectedEnquiry) {
        const updated = data.find((e) => e.id === selectedEnquiry.id);
        if (updated) setSelectedEnquiry(updated);
      }
    } catch (err) {
      console.error('Error fetching enquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllEnquiries();

    // Listen for live enquiry updates from website submissions
    const handleUpdate = () => loadAllEnquiries();
    window.addEventListener('navioraa_enquiries_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('navioraa_enquiries_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const openEnquiryModal = (enq: Enquiry) => {
    setSelectedEnquiry(enq);
    setActiveStatus(enq.status || 'new');
    setAssignedTo(enq.assignedTo || '');
    setInternalNotes(enq.internalNotes || '');
    setFollowUpDate(enq.followUpDate || '');
    setSaveSuccess(false);
  };

  const handleUpdate = async () => {
    if (!selectedEnquiry) return;
    setSavingNote(true);
    setSaveSuccess(false);

    try {
      await updateEnquiryStatus(selectedEnquiry.id, {
        status: activeStatus,
        assignedTo,
        internalNotes,
        followUpDate,
      });

      setSaveSuccess(true);
      await loadAllEnquiries();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update enquiry:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const promptDelete = (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirmTarget({ id, name });
  };

  const executeDelete = async () => {
    if (!deleteConfirmTarget) return;
    const targetId = deleteConfirmTarget.id;
    setDeletingId(targetId);
    try {
      await deleteEnquiry(targetId);
      if (selectedEnquiry?.id === targetId) {
        setSelectedEnquiry(null);
      }
      setEnquiries((prev) => prev.filter((e) => e.id !== targetId));
      setDeleteConfirmTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (enquiries.length === 0) {
      return;
    }

    const headers = ['ID', 'Full Name', 'Email', 'Phone', 'Program/Service', 'Status', 'Assigned To', 'Follow Up', 'Created At'];
    const rows = enquiries.map((e) => [
      e.id,
      `"${e.fullName.replace(/"/g, '""')}"`,
      `"${e.email}"`,
      `"${e.phone}"`,
      `"${(e.programOrService || '').replace(/"/g, '""')}"`,
      e.status,
      `"${(e.assignedTo || '').replace(/"/g, '""')}"`,
      `"${e.followUpDate || ''}"`,
      `"${e.createdAt}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `navioraa_inquiries_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = enquiries.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        (e.programOrService && e.programOrService.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const unresolvedTotal = enquiries.filter((e) => e.status === 'new' || !e.status).length;

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
              Admissions & Inquiries Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-extrabold text-xs">
              {unresolvedTotal} New
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time candidate applications, counselor assignment, status pipelines, and private counseling notes.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 text-slate-700 transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[17px] text-slate-500">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {(['all', 'new', 'in_progress', 'contacted', 'resolved', 'spam'] as const).map((st) => {
            const count = st === 'all' ? enquiries.length : enquiries.filter((e) => e.status === st).length;
            const active = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#0052FF] text-white shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{st.replace('_', ' ')}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0052FF] transition-all"
          />
        </div>
      </div>

      {/* Enquiries Grid / Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Enquiries List (Col 7 on desktop, full on mobile) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">Loading inbox telemetry...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-[36px] text-slate-400">inbox</span>
              <p className="font-bold text-slate-900">No enquiries found in this view.</p>
              <p>Try switching filter tabs or clearing your search term.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((enq) => {
                const isSelected = selectedEnquiry?.id === enq.id;
                const cleanPhone = (enq.phone || '').replace(/[^0-9]/g, '');
                const waLink = `https://wa.me/${cleanPhone}`;
                const mailtoLink = `mailto:${enq.email}?subject=Re:%20Navioraa%20Enquiry`;

                return (
                  <div
                    key={enq.id}
                    onClick={() => openEnquiryModal(enq)}
                    className={`p-4 sm:p-5 cursor-pointer transition-colors space-y-2.5 ${
                      isSelected ? 'bg-blue-50/70 border-l-4 border-[#0052FF]' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{enq.fullName}</span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              enq.status === 'new'
                                ? 'bg-rose-50 text-rose-600 border-rose-200 font-extrabold'
                                : enq.status === 'in_progress'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : enq.status === 'contacted'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : enq.status === 'resolved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {enq.status ? enq.status.replace('_', ' ') : 'new'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#0052FF] truncate mt-0.5">
                          {enq.programOrService}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {enq.email} · {enq.phone}
                        </p>
                      </div>

                      {/* Top Action Icons: Direct Delete Button */}
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => promptDelete(enq.id, enq.fullName, e)}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition-colors"
                          title="Delete enquiry"
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Message Preview */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                      "{enq.message}"
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline"
                        >
                          <span className="material-symbols-outlined text-[15px]">chat</span>
                          <span>WhatsApp</span>
                        </a>

                        <a
                          href={mailtoLink}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052FF] hover:underline"
                        >
                          <span className="material-symbols-outlined text-[15px]">mail</span>
                          <span>Email</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                        <span>{new Date(enq.createdAt).toLocaleDateString()}</span>
                        {enq.assignedTo && (
                          <span className="text-slate-600 font-medium">· {enq.assignedTo}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel (Col 5 on desktop, responsive drawer/card on mobile) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between h-fit sticky top-20 sm:top-24 space-y-5">
          {selectedEnquiry ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-base text-slate-900">Enquiry Details</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    ID: {selectedEnquiry.id.slice(0, 10)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => promptDelete(selectedEnquiry.id, selectedEnquiry.fullName, e)}
                    className="h-8 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-1 border border-rose-200 transition-colors"
                    title="Delete enquiry"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Delete</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEnquiry(null)}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
                    title="Close details"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Enquiry status and internal notes updated!</span>
                </div>
              )}

              {/* Applicant Info */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Full Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedEnquiry.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email</span>
                  <a href={`mailto:${selectedEnquiry.email}`} className="text-[#0052FF] font-medium hover:underline">
                    {selectedEnquiry.email}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phone / WhatsApp</span>
                  <a
                    href={`https://wa.me/${selectedEnquiry.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 font-medium hover:underline"
                  >
                    {selectedEnquiry.phone}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Program Requested</span>
                  <span className="font-semibold text-slate-900">{selectedEnquiry.programOrService}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 block text-[10px] font-bold uppercase mb-1">Applicant Message</span>
                  <p className="text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">{selectedEnquiry.message}</p>
                </div>
              </div>

              {/* CRM Update Controls */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-[#0052FF]">
                  Admissions Workflow & Notes
                </h3>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Status Pipeline</label>
                  <select
                    value={activeStatus}
                    onChange={(e) => setActiveStatus(e.target.value as EnquiryStatus)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0052FF]"
                  >
                    <option value="new">New / Uncontacted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="contacted">Contacted by Phone/WhatsApp</option>
                    <option value="resolved">Enrolled / Resolved</option>
                    <option value="spam">Spam / Junk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assign Counselor</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#0052FF]"
                  >
                    <option value="">Unassigned</option>
                    <option value="Admissions Counselor">Admissions Counseling Desk</option>
                    <option value="Academic Curriculum Lead">Academic Curriculum Lead</option>
                    <option value="Technical Project Lead">Technical & Project Engineering Lead</option>
                    <option value="Student Operations">Student Operations Desk</option>
                    <option value="Executive Advisory">Executive Advisory Office</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Follow-Up Target Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#0052FF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Internal Counselor Notes (Private)
                  </label>
                  <textarea
                    rows={3}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Enter confidential notes, student preferences, call summary..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0052FF] resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Internal notes are strictly protected by ABAC rules and never exposed to the public site.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={savingNote}
                  className="w-full h-10 rounded-xl bg-[#0052FF] hover:bg-[#0040CC] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-[#0052FF]/20 active:scale-98 transition-all disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{savingNote ? 'Saving...' : 'Update CRM Record'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-500 font-mono space-y-2">
              <span className="material-symbols-outlined text-[32px] text-slate-300">touch_app</span>
              <p>Select any enquiry from the list to view full applicant background, assign a counselor, or record internal notes.</p>
            </div>
          )}
        </div>
      </div>

      {/* In-App Delete Confirmation Modal (never blocked by iframe sandbox) */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-2xs">
              <span className="material-symbols-outlined text-[26px]">delete_forever</span>
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Delete Enquiry?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Permanently delete enquiry from <strong className="text-slate-800">{deleteConfirmTarget.name}</strong>. This record will be permanently removed from your CRM queue.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={Boolean(deletingId)}
                className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={Boolean(deletingId)}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-60"
              >
                {deletingId ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
