import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { getEnquiries } from '../../lib/data-service';

export const AdminLayout: React.FC = () => {
  const { currentUser, adminProfile, role, isOwner, isAdmin, isStaff, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unresolvedCount, setUnresolvedCount] = useState<number>(2);
  const [globalSearch, setGlobalSearch] = useState('');

  const loadBadge = async () => {
    try {
      const list = await getEnquiries();
      const unres = list.filter((e) => e.status === 'new' || !e.status).length;
      setUnresolvedCount(unres);
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    loadBadge();

    const handleUpdate = () => loadBadge();
    window.addEventListener('navioraa_enquiries_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    const timer = setInterval(loadBadge, 10000);
    return () => {
      window.removeEventListener('navioraa_enquiries_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(timer);
    };
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[#0052FF] text-[36px] animate-spin">
            progress_activity
          </span>
          <p className="text-xs font-bold text-slate-700">Authenticating NAVIORAA CMS...</p>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/admin/login" replace />;
  }

  // If logged in but lacks staff/admin role
  if (!isStaff) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <span className="material-symbols-outlined text-[48px] text-amber-500">lock_person</span>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Admin Access Required</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Logged in as <span className="font-bold text-slate-900">{currentUser.email}</span>, but your account does not have active administrative permissions.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/admin/login"
              className="h-10 rounded-xl bg-[#0052FF] text-white text-xs font-semibold flex items-center justify-center hover:bg-[#0040CC]"
            >
              Back to Sign In
            </Link>
            <button
              onClick={() => logout()}
              className="h-10 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-100 text-slate-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const coreModules = [
    { label: 'Academy LMS', path: '/admin/courses', icon: 'school' },
    { label: 'Cloud Clusters', path: '/admin/services', icon: 'dns' },
    { label: 'Showcase Projects', path: '/admin/projects', icon: 'rocket_launch' },
    { label: 'Learning Docs', path: '/admin/resources', icon: 'menu_book' },
    { label: 'Team & Faculty', path: '/admin/team', icon: 'groups' },
    { label: 'Inquiries Queue', path: '/admin/enquiries', icon: 'chat_bubble', badge: unresolvedCount },
    { label: 'Admin Access', path: '/admin/users', icon: 'manage_accounts' },
    { label: 'Homepage CMS', path: '/admin/homepage', icon: 'grid_view' },
    { label: 'Site Settings', path: '/admin/settings', icon: 'tune' },
    { label: 'Security Vault', path: '/admin/dashboard', icon: 'verified_user' },
  ];

  const isActive = (p: string) => location.pathname === p;

  const initials = adminProfile?.displayName
    ? adminProfile.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : currentUser.email?.slice(0, 2).toUpperCase() || 'NA';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row font-sans selection:bg-[#0052FF] selection:text-white">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-64 bg-white text-slate-700 flex-col justify-between flex-shrink-0 min-h-screen border-r border-slate-200/90 sticky top-0 h-screen overflow-y-auto shadow-xs">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-100 bg-white">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0052FF] to-[#00E5FF] flex items-center justify-center shadow-md shadow-[#0052FF]/20 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
            </div>
            <div className="min-w-0">
              <span className="font-heading font-extrabold text-sm text-slate-900 tracking-wider block">
                NAVIORAA
              </span>
              <span className="text-[10px] uppercase font-bold text-[#0052FF] tracking-widest block -mt-0.5">
                ADMIN PANEL
              </span>
            </div>
          </div>

          {/* Section: CORE MODULES */}
          <div className="p-3">
            <div className="px-3 pt-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              CORE MODULES
            </div>
            <nav className="space-y-1">
              {coreModules.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                      active
                        ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`material-symbols-outlined text-[19px] transition-colors ${active ? 'text-[#0052FF]' : 'text-slate-400 group-hover:text-slate-700'}`}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-extrabold border border-rose-200">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer: Current Admin Profile */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-[#0052FF] border border-blue-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">
                {adminProfile?.displayName || currentUser.email}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0052FF]">
                  {role === 'owner' ? 'SUPER ADMIN' : role?.toUpperCase() || 'ADMIN'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full h-8.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/90 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>

            <Link to="/admin/dashboard" className="flex items-center gap-2 group min-w-0">
              <span className="font-heading font-extrabold text-sm sm:text-base text-slate-900 tracking-tight truncate">
                Navioraa Admin
              </span>
              <span className="w-2 h-2 rounded-full bg-[#0052FF] hidden sm:inline-block" />
            </Link>
          </div>

          {/* Search Bar + Public Site Button + Profile Avatar */}
          <div className="flex items-center gap-3">
            {/* Query / Search input */}
            <div className="relative hidden lg:block w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Query systems, services, logs..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100/90 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0052FF] focus:bg-white transition-all"
              />
            </div>

            {/* Public Site button */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="h-8.5 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-[#0052FF] flex items-center gap-2 transition-colors flex-shrink-0 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              <span>Public Site</span>
            </a>

            {/* Avatar Pill */}
            <div className="w-8.5 h-8.5 rounded-full bg-blue-50 text-[#0052FF] border border-blue-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {initials}
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Dropdown */}
        {mobileSidebarOpen && (
          <div className="md:hidden bg-white text-slate-700 p-3 space-y-1 border-b border-slate-200 shadow-md">
            {coreModules.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                  isActive(item.path) ? 'bg-blue-50 text-[#0052FF] font-bold border border-blue-200' : 'text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-200">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={() => logout()}
              className="w-full mt-2 h-9 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold flex items-center justify-center gap-1 border border-rose-200"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Nested CMS View */}
        <main className="p-4 sm:p-6 lg:p-7 flex-1 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

