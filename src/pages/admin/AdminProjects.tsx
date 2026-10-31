import React, { useState, useEffect } from 'react';
import { getProjects, saveProject, deleteProject } from '../../lib/data-service';
import { ProjectItem } from '../../lib/types';

export const AdminProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProj, setEditingProj] = useState<Partial<ProjectItem> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [techInput, setTechInput] = useState('');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      const data = await getProjects(false);
      setProjects(data);
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
    setEditingProj({
      title: '',
      slug: '',
      category: 'Web Application',
      description: '',
      fullCaseStudy: '',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
      technologies: ['React', 'Node.js', 'PostgreSQL'],
      statusBadge: 'Production Deployed',
      externalUrl: '',
      githubUrl: '',
      featured: true,
      published: true,
      displayOrder: projects.length + 1,
    });
    setTechInput('');
  };

  const handleOpenEdit = (proj: ProjectItem) => {
    setIsNew(false);
    setEditingProj({ ...proj });
    setTechInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProj || !editingProj.title) {
      showNotice('error', 'Please enter a project title.');
      return;
    }

    setSaving(true);
    try {
      await saveProject(editingProj);
      setEditingProj(null);
      await loadData();
      showNotice('success', `Project "${editingProj.title}" successfully saved.`);
    } catch (err) {
      showNotice('error', 'Save failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const promptDeleteProject = (id: string, title: string) => {
    setDeleteConfirmTarget({ id, title });
  };

  const executeDeleteProject = async () => {
    if (!deleteConfirmTarget) return;
    const { id, title } = deleteConfirmTarget;
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmTarget(null);
      await loadData();
      showNotice('success', `Project "${title}" removed.`);
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
            Live Projects & Incubator Portfolio
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Showcase live student projects, enterprise client deliverables, and case studies.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all w-full sm:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Project</span>
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
        {projects.map((proj, idx) => (
          <div
            key={proj.id || idx}
            className="bg-white rounded-3xl border border-border-subtle shadow-2xs hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="relative h-40 w-full bg-slate-900 overflow-hidden">
                <img
                  src={proj.image}
                  alt={proj.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 bg-white/95 text-primary font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-md">
                  {proj.category}
                </span>
                <span className="absolute top-3 right-3 bg-black/60 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded-md">
                  {proj.statusBadge}
                </span>
              </div>

              <div className="p-5 space-y-2">
                <h3 className="font-heading font-bold text-base text-on-surface">{proj.title}</h3>
                <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                  {proj.description}
                </p>

                <div className="flex flex-wrap gap-1 pt-2">
                  {proj.technologies.map((t, ti) => (
                    <span
                      key={ti}
                      className="text-[10px] font-semibold bg-surface-subtle text-slate-700 px-2 py-0.5 rounded border border-border-subtle"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-subtle flex items-center justify-between">
              <span className={`text-[11px] font-bold ${proj.published ? 'text-emerald-700' : 'text-slate-400'}`}>
                {proj.published ? 'Published' : 'Hidden'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(proj)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 text-primary flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button
                  onClick={() => promptDeleteProject(proj.id, proj.title)}
                  title="Delete Project"
                  className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingProj && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-border-subtle shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h2 className="font-heading font-extrabold text-lg text-on-surface">
                {isNew ? 'Add Project' : `Edit: ${editingProj.title}`}
              </h2>
              <button
                onClick={() => setEditingProj(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface mb-1">Project Title *</label>
                  <input
                    type="text"
                    required
                    value={editingProj.title || ''}
                    onChange={(e) => {
                      const title = e.target.value;
                      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      setEditingProj({ ...editingProj, title, slug });
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface mb-1">Category</label>
                  <input
                    type="text"
                    value={editingProj.category || ''}
                    onChange={(e) => setEditingProj({ ...editingProj, category: e.target.value })}
                    placeholder="e.g. Mobile Health, FinTech AI"
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Image URL</label>
                <input
                  type="url"
                  value={editingProj.image || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, image: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={editingProj.description || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border-medium text-xs text-on-surface resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface mb-1">Full Case Study & Architecture</label>
                <textarea
                  rows={4}
                  value={editingProj.fullCaseStudy || ''}
                  onChange={(e) => setEditingProj({ ...editingProj, fullCaseStudy: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border-medium text-xs text-on-surface resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface mb-1">Status Badge</label>
                  <input
                    type="text"
                    value={editingProj.statusBadge || 'Production Deployed'}
                    onChange={(e) => setEditingProj({ ...editingProj, statusBadge: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface mb-1">Display Sequence Order</label>
                  <input
                    type="number"
                    min={1}
                    value={editingProj.displayOrder || 1}
                    onChange={(e) => setEditingProj({ ...editingProj, displayOrder: parseInt(e.target.value) || 1 })}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface text-center font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-on-surface">
                  <input
                    type="checkbox"
                    checked={editingProj.published ?? true}
                    onChange={(e) => setEditingProj({ ...editingProj, published: e.target.checked })}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span>Published on Website</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProj(null)}
                    className="h-10 px-4 rounded-xl border border-border-medium font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold uppercase tracking-wider shadow-xs"
                  >
                    {saving ? 'Saving...' : 'Save Project'}
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
                Delete Project?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Permanently delete showcase project <strong className="text-slate-800">"{deleteConfirmTarget.title}"</strong>. This item will be removed from your portfolio and live site.
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
                onClick={executeDeleteProject}
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
