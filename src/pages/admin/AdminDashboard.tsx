import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getEnquiries,
  getCourses,
  getProjects,
  getServices,
  getTeamMembers,
  getResources,
  updateEnquiryStatus,
  deleteEnquiry,
} from '../../lib/data-service';
import { Enquiry, Course, ProjectItem, ServiceItem, TeamMember, ResourceItem } from '../../lib/types';
import { useAuth } from '../../lib/auth-context';

export const AdminDashboard: React.FC = () => {
  const { adminProfile, currentUser, role, logout } = useAuth();
  const navigate = useNavigate();

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'in_progress' | 'contacted' | 'resolved'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAllData = async () => {
    try {
      const [enq, crs, prj, srv, tm, res] = await Promise.all([
        getEnquiries(),
        getCourses(false),
        getProjects(false),
        getServices(false),
        getTeamMembers(false),
        getResources(false),
      ]);
      setEnquiries(enq);
      setCourses(crs);
      setProjects(prj);
      setServices(srv);
      setTeam(tm);
      setResources(res);
    } catch (err) {
      console.warn('Dashboard data fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Listen for real-time enquiry updates so admin immediately updates when contact form is submitted
    const handleUpdate = () => loadAllData();
    window.addEventListener('navioraa_enquiries_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('navioraa_enquiries_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleStatusChange = async (enquiryId: string, newStatus: Enquiry['status']) => {
    setUpdatingId(enquiryId);
    try {
      await updateEnquiryStatus(enquiryId, { status: newStatus });
      setEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, status: newStatus } : e))
      );
    } catch (err) {
      console.error('Failed to update enquiry:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const promptDelete = (enquiryId: string, fullName: string) => {
    setDeleteConfirmTarget({ id: enquiryId, name: fullName });
  };

  const executeDelete = async () => {
    if (!deleteConfirmTarget) return;
    const targetId = deleteConfirmTarget.id;
    setDeletingId(targetId);
    try {
      await deleteEnquiry(targetId);
      setEnquiries((prev) => prev.filter((e) => e.id !== targetId));
      setDeleteConfirmTarget(null);
    } catch (err) {
      console.error('Failed to delete enquiry:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    if (enquiries.length === 0) {
      alert('No inquiries available to export.');
      return;
    }

    const headers = ['Enquiry ID', 'Full Name', 'Email', 'Phone', 'Program / Service', 'Message', 'Status', 'Date Submitted'];
    const rows = enquiries.map((e) => [
      `"${e.id}"`,
      `"${(e.fullName || '').replace(/"/g, '""')}"`,
      `"${(e.email || '').replace(/"/g, '""')}"`,
      `"${(e.phone || '').replace(/"/g, '""')}"`,
      `"${(e.programOrService || '').replace(/"/g, '""')}"`,
      `"${(e.message || '').replace(/"/g, '""')}"`,
      `"${e.status || 'new'}"`,
      `"${e.createdAt || ''}"`,
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

  // Calculations for Metrics
  const publishedServices = services.filter((s) => s.published).length;
  const draftServices = services.filter((s) => !s.published).length;

  const publishedCourses = courses.filter((c) => c.published).length;
  const draftCourses = courses.filter((c) => !c.published).length;

  const newUnresolvedCount = enquiries.filter((e) => e.status === 'new' || !e.status).length;
  const inProgressCount = enquiries.filter((e) => e.status === 'in_progress' || e.status === 'contacted').length;
  const resolvedCount = enquiries.filter((e) => e.status === 'resolved').length;

  // Category aggregations for the "Inquiry report" card
  const categoryCounts: Record<string, number> = {};
  enquiries.forEach((e) => {
    const cat = e.programOrService?.trim() || 'General Admissions';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  const filteredEnquiries = enquiries.filter((e) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'new') return e.status === 'new' || !e.status;
    return e.status === statusFilter;
  });

  const initials = adminProfile?.displayName
    ? adminProfile.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : currentUser?.email?.slice(0, 2).toUpperCase() || 'NA';

  return (
    <div className="space-y-6 text-slate-900">
      {/* 1. Subheader: Administrator Workspace / Content management */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest font-mono">
            <span>ADMINISTRATOR WORKSPACE</span>
            <span>/</span>
            <div className="flex items-center gap-1.5 text-[#0052FF] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#0052FF] animate-pulse" />
              <span>Content management</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            {enquiries.length} inquiries received · {newUnresolvedCount} pending action
          </p>
        </div>

        {/* User Profile Pill & Logout */}
        <div className="flex items-center gap-3 bg-white p-1.5 pl-3 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="w-8.5 h-8.5 rounded-full bg-blue-50 text-[#0052FF] border border-blue-200 flex items-center justify-center font-bold text-xs relative">
            {initials}
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-white" />
          </div>

          <div className="text-left pr-2">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-900 truncate max-w-[140px]">
                {adminProfile?.displayName || 'NAVIORA PVT'}
              </span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-[#0052FF] tracking-wider border border-blue-200">
                {role === 'owner' ? 'SUPER ADMIN' : 'ADMIN'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[160px]">
              {currentUser?.email || 'shubhammahadik3228@gmail.com'}
            </span>
          </div>

          <button
            onClick={() => logout()}
            className="h-8 px-3 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors"
            title="Sign out of Admin CMS"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Link
          to="/admin/services"
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center gap-2 whitespace-nowrap transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-400">dns</span>
          <span>IT Services</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {services.length}
          </span>
        </Link>

        <Link
          to="/admin/courses"
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center gap-2 whitespace-nowrap transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-400">school</span>
          <span>Training Courses</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {courses.length}
          </span>
        </Link>

        <Link
          to="/admin/projects"
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center gap-2 whitespace-nowrap transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-400">rocket_launch</span>
          <span>Showcase Projects</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {projects.length}
          </span>
        </Link>

        <Link
          to="/admin/resources"
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center gap-2 whitespace-nowrap transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-400">menu_book</span>
          <span>Learning Docs</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {resources.length}
          </span>
        </Link>

        <Link
          to="/admin/team"
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center gap-2 whitespace-nowrap transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px] text-slate-400">groups</span>
          <span>Team Faculty</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {team.length}
          </span>
        </Link>

        {/* Highlighted Tab: Inquiries Queue */}
        <Link
          to="/admin/enquiries"
          className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-[#0052FF] flex items-center gap-2 whitespace-nowrap font-bold shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
          <span>Inquiries Queue</span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
            {newUnresolvedCount}
          </span>
        </Link>
      </div>

      {/* 3. The 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Services */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-mono tracking-wider mb-2">
            <span>MODULAR FLEET</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0052FF] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">sync_alt</span>
            </div>
          </div>
          <h3 className="font-heading font-extrabold text-base text-slate-900">Active Services</h3>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{publishedServices}</span>
            <span className="text-xs text-[#0052FF] font-semibold">Published</span>
            <span className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {draftServices} Drafts
            </span>
          </div>
          <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#0052FF] rounded-full w-4/5" />
          </div>
        </div>

        {/* Card 2: Training Courses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-mono tracking-wider mb-2">
            <span>ACADEMY LMS</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
            </div>
          </div>
          <h3 className="font-heading font-extrabold text-base text-slate-900">Training Courses</h3>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{publishedCourses}</span>
            <span className="text-xs text-sky-600 font-semibold">Published</span>
            <span className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {draftCourses} Drafts
            </span>
          </div>
          <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0052FF] to-sky-400 rounded-full w-[90%]" />
          </div>
        </div>

        {/* Card 3: Portfolio Projects */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-mono tracking-wider mb-2">
            <span>CLIENT WORK</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
            </div>
          </div>
          <h3 className="font-heading font-extrabold text-base text-slate-900">Portfolio Projects</h3>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{projects.length}</span>
            <span className="text-xs text-emerald-600 font-semibold">Live Showcases</span>
            <span className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
              <span>↑ 100% Active</span>
            </span>
          </div>
          <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full w-full" />
          </div>
        </div>

        {/* Card 4: Client Inquiries */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-mono tracking-wider mb-2">
            <span>INBOUND QUEUE</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">mark_email_unread</span>
            </div>
          </div>
          <h3 className="font-heading font-extrabold text-base text-slate-900">Client Inquiries</h3>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{newUnresolvedCount}</span>
            <span className="text-xs text-rose-600 font-semibold">New Unresolved</span>
            <span className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-bold">
              Needs Review
            </span>
          </div>
          <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-500 via-purple-500 to-[#0052FF] rounded-full w-3/4" />
          </div>
        </div>
      </div>

      {/* 4. Inquiry Report Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-heading font-extrabold text-lg text-slate-900">Inquiry report</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Submission volume, follow-up status, and client interest by category.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {enquiries.length} received in the last 30 days
          </span>
        </div>

        {/* 4 Statistical Pillars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-3xl font-extrabold text-slate-900 font-mono leading-none">
              {enquiries.length}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">All inquiries</p>
          </div>
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100">
            <p className="text-3xl font-extrabold text-[#0052FF] font-mono leading-none">
              {newUnresolvedCount}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">New</p>
          </div>
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-100">
            <p className="text-3xl font-extrabold text-amber-600 font-mono leading-none">
              {inProgressCount}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">In progress</p>
          </div>
          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <p className="text-3xl font-extrabold text-emerald-600 font-mono leading-none">
              {resolvedCount}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">Resolved</p>
          </div>
        </div>

        {/* Category Breakdown Progress Bars */}
        {sortedCategories.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            {sortedCategories.slice(0, 4).map(([catName, count]) => {
              const pct = Math.max(15, Math.round((count / Math.max(1, enquiries.length)) * 100));
              return (
                <div key={catName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{catName}</span>
                    <span className="font-mono text-slate-500 font-bold">{count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0052FF] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Inquiries Queue & Live Telemetry Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Queue Table & Filter) - 7 cols */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-base text-slate-900">Inquiries Queue</h2>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  {newUnresolvedCount}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage applications, follow-ups, and student consultations.
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="h-8.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500">download</span>
              <span>Export spreadsheet</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {(['all', 'new', 'in_progress', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] font-bold transition-colors ${
                  statusFilter === st
                    ? 'bg-[#0052FF] text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Enquiries Card List */}
          <div className="space-y-3">
            {filteredEnquiries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-50 rounded-xl border border-slate-200">
                No inquiries matching filter criteria.
              </div>
            ) : (
              filteredEnquiries.map((enq) => {
                const cleanPhone = (enq.phone || '').replace(/[^0-9]/g, '');
                const waLink = `https://wa.me/${cleanPhone}`;
                const mailtoLink = `mailto:${enq.email}?subject=Re:%20Navioraa%20Inquiry%20-%20${encodeURIComponent(enq.programOrService || 'Admissions')}`;

                return (
                  <div
                    key={enq.id}
                    className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 space-y-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#0052FF]" />
                          <h4 className="font-bold text-sm text-slate-900">{enq.fullName}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono">
                            {enq.programOrService}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {enq.email} · {enq.phone}
                        </p>
                      </div>

                      {/* Status Selector Dropdown & Delete Icon */}
                      <div className="flex items-center gap-2">
                        <select
                          value={enq.status || 'new'}
                          disabled={updatingId === enq.id}
                          onChange={(e) => handleStatusChange(enq.id, e.target.value as Enquiry['status'])}
                          className="h-7 px-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#0052FF]"
                        >
                          <option value="new">New</option>
                          <option value="in_progress">In Progress</option>
                          <option value="contacted">Follow Up / Contacted</option>
                          <option value="resolved">Resolved</option>
                        </select>

                        <button
                          onClick={() => promptDelete(enq.id, enq.fullName)}
                          className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                          title="Delete enquiry"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Query Message Preview */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200/80 text-xs text-slate-700 font-sans leading-relaxed">
                      "{enq.message}"
                    </div>

                    {/* Actions: WhatsApp & Email Reply */}
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline"
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        <span>WhatsApp</span>
                      </a>

                      <a
                        href={mailtoLink}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052FF] hover:underline"
                      >
                        <span className="material-symbols-outlined text-[16px]">mail</span>
                        <span>Email Reply</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Inquiries Stream panel) - 5 cols */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="font-heading font-extrabold text-base text-slate-900">Inquiries Stream</h3>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-mono">
              {newUnresolvedCount} UNRESOLVED
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Live sync incoming telemetry from public RFPs, consultation schedules, and Academy applications.
          </p>

          {/* Stream Cards */}
          <div className="space-y-3 pt-1">
            {enquiries.slice(0, 6).map((enq) => {
              const cleanPhone = (enq.phone || '').replace(/[^0-9]/g, '');
              const waLink = `https://wa.me/${cleanPhone}`;
              const mailtoLink = `mailto:${enq.email}?subject=Re:%20Navioraa%20Enquiry`;
              const isUnresolved = enq.status === 'new' || !enq.status;

              return (
                <div
                  key={`stream-${enq.id}`}
                  className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isUnresolved ? 'bg-[#0052FF]' : 'bg-emerald-500'}`} />
                      <span className="font-bold text-xs text-slate-900 truncate">{enq.fullName}</span>
                    </div>

                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0052FF] border border-blue-200 tracking-wider flex-shrink-0">
                      {enq.programOrService?.split(' ')[0] || 'INTERNSHIP'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">domain</span>
                    <span className="truncate">{enq.email}</span>
                  </div>

                  <p className="text-xs text-slate-600 italic line-clamp-2">
                    "{enq.message}"
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex items-center gap-2">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 px-2 rounded-lg bg-white hover:bg-slate-100 text-emerald-600 border border-slate-200 flex items-center gap-1 font-semibold text-[11px] shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[14px]">chat</span>
                        <span>WhatsApp</span>
                      </a>

                      <a
                        href={mailtoLink}
                        className="p-1 px-2 rounded-lg bg-white hover:bg-slate-100 text-[#0052FF] border border-slate-200 flex items-center gap-1 font-semibold text-[11px] shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[14px]">mail</span>
                        <span>Email Reply</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isUnresolved && (
                        <button
                          onClick={() => handleStatusChange(enq.id, 'resolved')}
                          className="p-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 font-semibold text-[11px]"
                          title="Mark inquiry as resolved"
                        >
                          <span className="material-symbols-outlined text-[14px]">done_all</span>
                          <span>Resolve</span>
                        </button>
                      )}
                      <button
                        onClick={() => promptDelete(enq.id, enq.fullName)}
                        className="p-1 px-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete enquiry"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
                Permanently delete enquiry from <strong className="text-slate-800">{deleteConfirmTarget.name}</strong>. This record will be permanently removed from your dashboard and CRM queue.
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
