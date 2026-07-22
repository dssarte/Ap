import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  Home,
  Inbox,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react';

const LOGO_URL = '/assets/figaro-logo.png';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [hasAuditAssignments, setHasAuditAssignments] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.user_type === 'approver' || user?.user_type === 'store_manager') {
      loadPendingCount();
    }
    if (user && !['admin', 'department_head'].includes(user.user_type)) {
      if (user.store_name) {
        setHasAuditAssignments(true);
      } else {
        base44.entities.AuditAssignment.filter({ user_email: user.email, is_active: true })
          .then((assignments) => setHasAuditAssignments(assignments.length > 0))
          .catch(() => {});
      }
    }
  }, [user]);

  const loadPendingCount = async () => {
    if (!user?.email) return;
    try {
      const allTickets = await base44.entities.Ticket.list();
      const pending = user.user_type === 'store_manager'
        ? allTickets.filter((ticket) => ticket.approval_status === 'pending' && ticket.store_name && (user.assigned_stores || []).includes(ticket.store_name))
        : allTickets.filter((ticket) => ticket.approval_status === 'pending' && ticket.approver_email === user.email);
      setPendingApprovalCount(pending.length);
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  const displayName = user?.display_name || user?.full_name || user?.email || 'Account';
  const initials = displayName.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
  const isQA = user?.department_name === 'Quality Assurance' || user?.user_type === 'admin';

  let navItems = [{ name: 'Overview', icon: Home, page: 'Home' }];

  if (user?.user_type === 'store_manager') {
    if (user.assigned_stores?.length) {
      navItems.push(
        { name: 'Approval queue', icon: Inbox, page: 'ApprovalQueue', badge: pendingApprovalCount || null },
        { name: 'Conduct audit', icon: ClipboardList, page: 'Audit' },
        { name: 'Store analytics', icon: BarChart3, page: 'StoreAuditAnalytics' },
        { name: 'Daily summary', icon: CalendarCheck, page: 'DailySummary' },
        { name: 'Audit dashboard', icon: ClipboardCheck, page: 'AuditDashboard' },
      );
    }
  } else {
    if (user?.user_type === 'approver') navItems.push({ name: 'Approval queue', icon: Inbox, page: 'ApprovalQueue', badge: pendingApprovalCount || null });
    if (user?.user_type === 'department_head') {
      navItems.push(
        { name: 'My tickets', icon: Inbox, page: 'DepartmentDashboard' },
        { name: 'Department analytics', icon: BarChart3, page: 'DeptAnalytics' },
      );
    }
    if (['admin', 'department_head'].includes(user?.user_type)) navItems.push({ name: 'Reports', icon: FileBarChart, page: 'Reports' });
    if (user?.user_type === 'admin') {
      navItems.push(
        { name: 'Analytics', icon: BarChart3, page: 'Analytics' },
        { name: 'Daily summary', icon: CalendarCheck, page: 'DailySummary' },
        { name: 'Administration', icon: Settings, page: 'Admin' },
      );
    }
    if (isQA || hasAuditAssignments) navItems.push({ name: 'Conduct audit', icon: ClipboardList, page: 'Audit' });
    if (user?.store_name) navItems.push({ name: 'Store analytics', icon: BarChart3, page: 'StoreAuditAnalytics' });
    if (isQA) {
      navItems.push(
        { name: 'Store ranking', icon: Trophy, page: 'StoreRanking' },
        { name: 'Audit dashboard', icon: ShieldCheck, page: 'AuditDashboard' },
      );
    }
  }
  navItems.push({ name: 'Help & manual', icon: BookOpen, page: 'UserManual' });

  const currentItem = navItems.find((item) => item.page === currentPageName);

  const Navigation = ({ mobile = false }) => (
    <nav className="space-y-1.5" aria-label="Main navigation">
      {navItems.map((item) => {
        const active = currentPageName === item.page;
        return (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            onClick={() => mobile && setMobileMenuOpen(false)}
            className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${active
              ? 'bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200/70'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
          >
            <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-700'}`} />
            <span className="flex-1">{item.name}</span>
            {item.badge && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a href="#main-content" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0">Skip to main content</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Link to={createPageUrl('Home')} className="flex h-20 items-center border-b border-slate-100 px-6">
          <img src={LOGO_URL} alt="Figaro Coffee Group" className="h-12 w-auto object-contain" />
        </Link>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
          <Navigation />
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
              <CircleHelp className="h-4 w-4 text-emerald-700" /> Need assistance?
            </div>
            Visit Help & manual for step-by-step guidance.
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col bg-white shadow-2xl">
            <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
              <img src={LOGO_URL} alt="Figaro Coffee Group" className="h-12 w-auto" />
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4"><Navigation mobile /></div>
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{currentItem?.name || currentPageName}</p>
              <p className="hidden text-xs text-slate-500 sm:block">Figaro Support & Audit Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11 gap-2 rounded-xl px-1.5 sm:pr-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-800">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="hidden max-w-36 text-left sm:block">
                      <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
                      <p className="truncate text-[11px] capitalize text-slate-500">{user.user_type?.replace('_', ' ') || 'Member'}</p>
                    </div>
                    <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
                  <div className="px-2 py-2">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    {user.department_name && <p className="mt-1 text-xs text-emerald-700">{user.department_name}</p>}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => base44.auth.logout('/')} className="rounded-lg text-rose-600 focus:text-rose-700">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-5rem)] focus:outline-none">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-6 py-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Figaro Coffee Group. Internal support workspace.
        </footer>
      </div>
    </div>
  );
}
