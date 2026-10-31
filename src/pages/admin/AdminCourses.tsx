import React, { useState, useEffect } from 'react';
import { getCourses, saveCourse, deleteCourse, getCategories } from '../../lib/data-service';
import { Course, CourseCategory, SyllabusModule } from '../../lib/types';

export const AdminCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor Modal State
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [techInput, setTechInput] = useState('');
  const [outcomeInput, setOutcomeInput] = useState('');

  // Deletion Modal State (never blocked by iframe sandboxes)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      const [crs, cats] = await Promise.all([getCourses(false), getCategories(false)]);
      setCourses(crs);
      setCategories(cats);
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
    setEditingCourse({
      title: '',
      slug: '',
      shortDescription: '',
      fullDescription: '',
      thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
      category: categories[0]?.name || 'Full Stack Development',
      technologies: ['Python', 'PostgreSQL'],
      skillLevel: 'Beginner',
      duration: '12 Weeks',
      rating: 4.9,
      projectsCount: 4,
      syllabus: [
        { title: 'Module 1: Foundations', topics: ['Core Concepts', 'Environment Setup'] }
      ],
      learningOutcomes: ['Build functional real-world applications'],
      featured: false,
      published: true,
      displayOrder: courses.length + 1,
    });
    setTechInput('');
    setOutcomeInput('');
  };

  const handleOpenEdit = (course: Course) => {
    setIsNew(false);
    setEditingCourse({ ...course });
    setTechInput('');
    setOutcomeInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editingCourse.title || !editingCourse.slug) {
      showNotice('error', 'Please provide course title and slug.');
      return;
    }

    setSaving(true);
    try {
      await saveCourse(editingCourse);
      setEditingCourse(null);
      await loadData();
      showNotice('success', `Course "${editingCourse.title}" successfully saved.`);
    } catch (err) {
      showNotice('error', 'Failed to save course: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const promptDeleteCourse = (id: string, title: string) => {
    setDeleteConfirmTarget({ id, title });
  };

  const executeDeleteCourse = async () => {
    if (!deleteConfirmTarget) return;
    const { id, title } = deleteConfirmTarget;
    setDeletingId(id);
    try {
      await deleteCourse(id);
      // Immediately reflect in state
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirmTarget(null);
      await loadData();
      showNotice('success', `Course "${title}" removed.`);
    } catch (err) {
      showNotice('error', 'Delete failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (course: Course) => {
    try {
      await saveCourse({ ...course, published: !course.published });
      await loadData();
    } catch (err) {
      showNotice('error', 'Failed to update publish state: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleToggleFeature = async (course: Course) => {
    try {
      await saveCourse({ ...course, featured: !course.featured });
      await loadData();
    } catch (err) {
      showNotice('error', 'Failed to update featured state: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-on-surface">
            Course Catalog & Syllabi Manager
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Create, edit, feature, and publish technology training programs on the public website.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all w-full sm:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Add New Course</span>
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

      {/* Courses List - Responsive Desktop Table + Mobile Cards */}
      <div className="bg-white rounded-3xl border border-border-subtle shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No courses in database. Click "Add New Course" or Seed from the Dashboard.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle text-slate-500 font-semibold border-b border-border-subtle">
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Course Program</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Level & Duration</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-text-muted">
                        #{course.displayOrder}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={course.thumbnail}
                            alt={course.title}
                            className="w-12 h-9 rounded-lg object-cover border border-border-subtle"
                          />
                          <div>
                            <p className="font-bold text-on-surface">{course.title}</p>
                            <p className="text-[11px] text-text-muted truncate max-w-xs">{course.shortDescription}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-primary">
                        {course.category}
                      </td>
                      <td className="px-5 py-3.5 text-text-muted">
                        {course.skillLevel} · {course.duration}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePublish(course)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                              course.published
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {course.published ? 'Published' : 'Draft'}
                          </button>
                          {course.featured && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                              Featured
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleFeature(course)}
                            title="Toggle Featured"
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              course.featured ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">star</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(course)}
                            title="Edit Course"
                            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-primary"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => promptDeleteCourse(course.id, course.title)}
                            title="Delete Course"
                            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (optimized for touch & compact screens) */}
            <div className="md:hidden divide-y divide-border-subtle">
              {courses.map((course) => (
                <div key={course.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-16 h-12 rounded-xl object-cover border border-border-subtle flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                          {course.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">#{course.displayOrder}</span>
                      </div>
                      <h3 className="font-heading font-bold text-sm text-on-surface leading-tight mt-0.5">
                        {course.title}
                      </h3>
                      <p className="text-[11px] text-text-muted mt-1 line-clamp-1">{course.shortDescription}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTogglePublish(course)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          course.published
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {course.published ? 'Published' : 'Draft'}
                      </button>
                      {course.featured && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-2 py-1 rounded-full">
                          ★
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleFeature(course)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          course.featured ? 'text-amber-500 bg-amber-50' : 'text-slate-400 bg-slate-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[17px]">star</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(course)}
                        className="h-8 px-2.5 rounded-lg bg-blue-50 text-primary text-xs font-bold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => promptDeleteCourse(course.id, course.title)}
                        className="h-8 px-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Course Editor Modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col border border-border-subtle">
            {/* Modal Header */}
            <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface-subtle">
              <h2 className="font-heading font-extrabold text-lg text-on-surface">
                {isNew ? 'Create New Course Program' : `Edit: ${editingCourse.title}`}
              </h2>
              <button
                onClick={() => setEditingCourse(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Course Title *</label>
                  <input
                    type="text"
                    required
                    value={editingCourse.title || ''}
                    onChange={(e) => {
                      const title = e.target.value;
                      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      setEditingCourse({ ...editingCourse, title, slug });
                    }}
                    placeholder="e.g. Python Full Stack Development"
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={editingCourse.slug || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, slug: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Category *</label>
                  <select
                    value={editingCourse.category || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id || cat.slug} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Skill Level</label>
                  <select
                    value={editingCourse.skillLevel || 'Beginner'}
                    onChange={(e) => setEditingCourse({ ...editingCourse, skillLevel: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="All Skill Levels">All Skill Levels</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Duration</label>
                  <input
                    type="text"
                    value={editingCourse.duration || '12 Weeks'}
                    onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                    placeholder="e.g. 16 Weeks"
                    className="w-full h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Thumbnail Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={editingCourse.thumbnail || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, thumbnail: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 h-10 px-3 rounded-xl border border-border-medium text-xs text-on-surface"
                  />
                  {editingCourse.thumbnail && (
                    <img
                      src={editingCourse.thumbnail}
                      alt="Preview"
                      className="w-12 h-10 rounded-lg object-cover border border-border-subtle"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Short Description (for Cards)</label>
                <textarea
                  rows={2}
                  value={editingCourse.shortDescription || ''}
                  onChange={(e) => setEditingCourse({ ...editingCourse, shortDescription: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border-medium text-xs text-on-surface resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Full Description</label>
                <textarea
                  rows={4}
                  value={editingCourse.fullDescription || ''}
                  onChange={(e) => setEditingCourse({ ...editingCourse, fullDescription: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border-medium text-xs text-on-surface resize-none"
                />
              </div>

              {/* Technologies Array */}
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Technologies Covered</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editingCourse.technologies?.map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-surface-muted border border-border-subtle rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <span>{tech}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingCourse.technologies?.filter((_, i) => i !== idx);
                          setEditingCourse({ ...editingCourse, technologies: updated });
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
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (techInput.trim()) {
                          setEditingCourse({
                            ...editingCourse,
                            technologies: [...(editingCourse.technologies || []), techInput.trim()],
                          });
                          setTechInput('');
                        }
                      }
                    }}
                    placeholder="Add tech (e.g. Docker) and click Add"
                    className="flex-1 h-9 px-3 rounded-xl border border-border-medium text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (techInput.trim()) {
                        setEditingCourse({
                          ...editingCourse,
                          technologies: [...(editingCourse.technologies || []), techInput.trim()],
                        });
                        setTechInput('');
                      }
                    }}
                    className="px-4 h-9 bg-primary-light text-primary rounded-xl text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Publication Status & Ordering */}
              <div className="p-4 rounded-2xl bg-surface-subtle border border-border-subtle flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                    <input
                      type="checkbox"
                      checked={editingCourse.published ?? true}
                      onChange={(e) => setEditingCourse({ ...editingCourse, published: e.target.checked })}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span>Published to Public Site</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                    <input
                      type="checkbox"
                      checked={editingCourse.featured ?? false}
                      onChange={(e) => setEditingCourse({ ...editingCourse, featured: e.target.checked })}
                      className="w-4 h-4 text-amber-500 rounded"
                    />
                    <span>Feature on Homepage</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface">Display Order:</span>
                  <input
                    type="number"
                    min={1}
                    value={editingCourse.displayOrder || 1}
                    onChange={(e) => setEditingCourse({ ...editingCourse, displayOrder: parseInt(e.target.value) || 1 })}
                    className="w-16 h-8 px-2 rounded-lg border border-border-medium text-xs font-bold text-center"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="h-10 px-5 rounded-xl border border-border-medium text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{saving ? 'Saving...' : 'Save Course'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (never blocked by iframe sandbox) */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-2xs">
              <span className="material-symbols-outlined text-[26px]">delete_forever</span>
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-900">
                Delete Course?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Permanently delete <strong className="text-slate-800">"{deleteConfirmTarget.title}"</strong>. This course will be immediately removed from both your admin catalog and the public website.
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
                onClick={executeDeleteCourse}
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
