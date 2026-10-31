import React, { useState, useEffect } from 'react';
import { getServices, saveService, deleteService } from '../../lib/data-service';
import { ServiceItem } from '../../lib/types';

export const AdminServices: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Partial<ServiceItem> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [featureInput, setFeatureInput] = useState('');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      const data = await getServices(false);
      setServices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleOpenNew = () => {
    setIsNew(true);
    setEditingService({
      title: '',
      slug: '',
      shortDescription: '',
      fullDescription: '',
      icon: 'terminal',
      features: ['High-Availability Architecture', 'Cloud Deployment'],
      displayOrder: services.length + 1,
      published: true,
    });
    setFeatureInput('');
  };

  const handleOpenEdit = (srv: ServiceItem) => {
    setIsNew(false);
    setEditingService({ ...srv });
    setFeatureInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !editingService.title) {
      showNotice('error', 'Please enter a service title.');
      return;
    }

    setSaving(true);
    try {
      await saveService(editingService);
      setEditingService(null);
      await loadData();
      showNotice('success', `Service "${editingService.title}" successfully saved.`);
    } catch (err) {
      showNotice('error', 'Save failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const promptDeleteService = (id: string, title: string) => {
    setDeleteConfirmTarget({ id, title });
  };

  const executeDeleteService = async () => {
    if (!deleteConfirmTarget) return;
    const { id, title } = deleteConfirmTarget;
    setDeletingId(id);
    try {
      await deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmTarget(null);
      await loadData();
      showNotice('success', `Service "${title}" removed.`);
    } catch (err) {
      showNotice('error', 'Delete failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-on-surface">
            Enterprise Services Manager
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Manage agency engineering services, cloud migration solutions, and custom software offerings.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all w-full sm:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Service</span>
        </button>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {notice.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map((srv, idx) => (
          <div
            key={srv.id || idx}
            className="bg-white rounded-3xl p-5 border border-border-subtle shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">{srv.icon || 'terminal'}</span>
                </span>
                <div>
                  <h3 className="font-heading font-bold text-sm text-on-surface">{srv.title}</h3>
                  <span className={`text-[10px] font-bold uppercase ${srv.published ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {srv.published ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant line-clamp-3 mb-3 leading-relaxed">
                {srv.shortDescription}
              </p>

              <div className="space-y-1 pt-2 border-t border-border-subtle">
                {srv.features?.map((f, fi) => (
                  <p key={fi} className="text-[11px] text-text-muted flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[14px]">check</span>
                    <span>{f}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border-subtle mt-4 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Order: #{srv.displayOrder}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(srv)}
                  title="Edit Service"
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 text-primary flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button
                  onClick={() => promptDeleteService(srv.id, srv.title)}
                  title="Delete Service"
                  className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-border-subtle shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h2 className="font-heading font-extrabold text-lg text-on-surface">
                {isNew ? 'Create Service' : `Edit: ${editingService.title}`}
              </h2>
              <button
                onClick={() => setEditingService(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface mb-1">Service Title *</label>
                  <input
                    type="text"
                    required
                    value={editingService.title || ''}
                    onChange={(e) => {
                      const title = e.target.value;
                      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      setEditingService({ ...editingService, title, slug });
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface mb-1">URL Slug</label>
                  <input
                    type="text"
                    value={editingService.slug || ''}
                    onChange={(e) => setEditingService({ ...editingService, slug: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Material Symbol Icon</label>
                <input
                  type="text"
                  value={editingService.icon || 'terminal'}
                  onChange={(e) => setEditingService({ ...editingService, icon: e.target.value })}
                  placeholder="cloud_sync, terminal, phone_iphone, psychology"
                  className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={editingService.shortDescription || ''}
                  onChange={(e) => setEditingService({ ...editingService, shortDescription: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border-medium text-xs text-on-surface resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Key Deliverable Features</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editingService.features?.map((f, fi) => (
                    <span
                      key={fi}
                      className="px-2.5 py-1 bg-surface-muted border border-border-subtle rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <span>{f}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingService.features?.filter((_, i) => i !== fi);
                          setEditingService({ ...editingService, features: updated });
                        }}
                        className="text-slate-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder="Add feature and press Add"
                    className="flex-1 h-9 px-3 rounded-xl border border-border-medium text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (featureInput.trim()) {
                        setEditingService({
                          ...editingService,
                          features: [...(editingService.features || []), featureInput.trim()],
                        });
                        setFeatureInput('');
                      }
                    }}
                    className="px-3.5 h-9 bg-primary-light text-primary font-bold rounded-xl text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-on-surface">
                  <input
                    type="checkbox"
                    checked={editingService.published ?? true}
                    onChange={(e) => setEditingService({ ...editingService, published: e.target.checked })}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span>Published on Website</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingService(null)}
                    className="h-10 px-4 rounded-xl border border-border-medium font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold uppercase tracking-wider shadow-xs"
                  >
                    {saving ? 'Saving...' : 'Save Service'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-2xs">
              <span className="material-symbols-outlined text-[26px]">delete_forever</span>
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Delete Service?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Permanently delete <strong className="text-slate-800">"{deleteConfirmTarget.title}"</strong>. This engineering service offering will be removed from your catalog and website.
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
                onClick={executeDeleteService}
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
