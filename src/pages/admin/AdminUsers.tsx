import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth-context';
import { AdminUser, Role } from '../../lib/types';

export const AdminUsers: React.FC = () => {
  const { isOwner, currentUser, role } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // New admin input
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('admin');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [revokeConfirmTarget, setRevokeConfirmTarget] = useState<{ uid: string; email: string } | null>(null);
  const [revokingUid, setRevokingUid] = useState<string | null>(null);

  const loadAdmins = async () => {
    try {
      const snap = await getDocs(collection(db, 'admins'));
      const list: AdminUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          uid: d.id,
          email: data.email || '',
          displayName: data.displayName || data.email?.split('@')[0] || 'Team Admin',
          role: data.role || 'admin',
          createdAt: data.createdAt,
        });
      });

      // Guarantee primary super admin Shubham Mahadik is visible
      if (!list.some((a) => a.email.toLowerCase() === 'shubhammahadik3228@gmail.com')) {
        list.unshift({
          uid: 'super-admin-shubham',
          email: 'shubhammahadik3228@gmail.com',
          displayName: 'Shubham Mahadik (Founder & Super Admin)',
          role: 'owner',
        });
      }

      // Guarantee naviora.pvt@gmail.com is visible
      if (!list.some((a) => a.email.toLowerCase() === 'naviora.pvt@gmail.com')) {
        list.unshift({
          uid: 'bootstrap-owner',
          email: 'naviora.pvt@gmail.com',
          displayName: 'Naviora Pvt (Executive)',
          role: 'owner',
        });
      }

      setAdmins(list);
    } catch (err) {
      console.warn('Error reading admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!isOwner) {
      setErrorMsg('Only the Super Admin / Owner can assign new administrator roles.');
      return;
    }

    if (!newEmail.trim()) return;

    setSaving(true);
    setStatusMsg(null);
    try {
      const pseudoId = 'admin_' + newEmail.trim().replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(doc(db, 'admins', pseudoId), {
        email: newEmail.trim().toLowerCase(),
        displayName: newName.trim() || newEmail.split('@')[0],
        role: newRole,
        createdAt: new Date().toISOString(),
      });

      setStatusMsg(`Permissions granted to ${newEmail} as ${newRole.toUpperCase()}. They can now sign in at /admin.`);
      setNewEmail('');
      setNewName('');
      await loadAdmins();
    } catch (err) {
      setErrorMsg('Failed to grant role: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const promptRevokeRole = (uid: string, email: string) => {
    setErrorMsg(null);
    if (!isOwner) {
      setErrorMsg('Only the Owner can revoke administrative privileges.');
      return;
    }
    const emailLower = email.toLowerCase();
    if (emailLower === 'shubhammahadik3228@gmail.com' || emailLower === 'naviora.pvt@gmail.com') {
      setErrorMsg('Cannot revoke primary founder / super admin permissions.');
      return;
    }
    setRevokeConfirmTarget({ uid, email });
  };

  const executeRevokeRole = async () => {
    if (!revokeConfirmTarget) return;
    const { uid, email } = revokeConfirmTarget;
    setRevokingUid(uid);
    try {
      await deleteDoc(doc(db, 'admins', uid));
      setRevokeConfirmTarget(null);
      setStatusMsg(`Administrative privileges revoked for ${email}.`);
      await loadAdmins();
    } catch (err) {
      setErrorMsg('Revoke error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRevokingUid(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl text-slate-900">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-slate-900">
          Team Access Control & Role Permissions
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Attribute-Based Access Control (ABAC). Delegate site administration, course curriculum management, and inquiry follow-ups to your team members.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Add New Admin (Owner Only) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <h2 className="font-heading font-bold text-sm text-[#0052FF] uppercase tracking-wider">
          Authorize New Team Member
        </h2>
        {isOwner ? (
          <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-1">
              <label className="block font-bold text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sakshi"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0052FF]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="teammember@navioraa.com"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0052FF]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Role Permission</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0052FF]"
              >
                <option value="admin">Admin (Full Control)</option>
                <option value="editor">Editor (Content Only)</option>
                <option value="owner">Super Admin (Owner)</option>
              </select>
            </div>

            <div className="sm:col-span-4 flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-6 rounded-xl bg-[#0052FF] hover:bg-[#0040CC] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-[#0052FF]/20 active:scale-98 transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">security</span>
                <span>{saving ? 'Granting Access...' : 'Authorize Member'}</span>
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            Only accounts with the <span className="font-bold text-[#0052FF]">Super Admin / Owner</span> role can authorize new administrators. Your current active role is: <span className="font-bold text-slate-900">{role?.toUpperCase()}</span>.
          </p>
        )}
      </div>

      {/* Current Authorized List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-heading font-bold text-sm text-slate-900 uppercase tracking-wider">
            Active Administrative Roster
          </h2>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {admins.map((adm) => {
            const isProtected = adm.email.toLowerCase() === 'shubhammahadik3228@gmail.com' || adm.email.toLowerCase() === 'naviora.pvt@gmail.com';
            return (
              <div key={adm.uid} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0052FF] border border-blue-200 flex items-center justify-center font-extrabold text-xs">
                    {adm.displayName?.slice(0, 2).toUpperCase() || 'AD'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-sm">{adm.displayName}</p>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          adm.role === 'owner'
                            ? 'bg-blue-50 text-[#0052FF] border-blue-200 font-extrabold'
                            : adm.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {adm.role === 'owner' ? 'SUPER ADMIN (OWNER)' : adm.role?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-500 font-mono text-[11px] mt-0.5">{adm.email}</p>
                  </div>
                </div>

                {isOwner && !isProtected && (
                  <button
                    onClick={() => promptRevokeRole(adm.uid, adm.email)}
                    title="Revoke Admin Privileges"
                    className="h-8 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-semibold text-xs transition-colors shadow-2xs"
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* In-App Revoke Confirmation Modal */}
      {revokeConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-2xs">
              <span className="material-symbols-outlined text-[26px]">lock_reset</span>
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Revoke Admin Role?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Revoke all administrative access for <strong className="text-slate-800">"{revokeConfirmTarget.email}"</strong>. They will no longer be able to log in to the admin panel.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevokeConfirmTarget(null)}
                disabled={Boolean(revokingUid)}
                className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRevokeRole}
                disabled={Boolean(revokingUid)}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-60"
              >
                {revokingUid ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Revoking...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    <span>Confirm Revoke</span>
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
