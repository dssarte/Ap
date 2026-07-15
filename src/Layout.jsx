import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Settings, LogOut, Menu, X, BarChart3, BookOpen, ClipboardList, Trophy, CalendarCheck } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [hasAuditAssignments, setHasAuditAssignments] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.user_type === 'approver' || user?.user_type === 'store_manager') {
      loadPendingCount();
    }
    if (user && user.user_type !== 'admin' && user.user_type !== 'department_head') {
      // Show Audit nav if user has a store_name (store-restricted templates) OR has explicit assignments
      if (user.store_name) {
        setHasAuditAssignments(true);
      } else {
        base44.entities.AuditAssignment.filter({ user_email: user.email, is_active: true })
          .then(assignments => setHasAuditAssignments(assignments.length > 0))
          .catch(() => {});
      }
    }
  }, [user]);

  const loadPendingCount = async () => {
    if (!user?.email) return;
    try {
      const allTickets = await base44.entities.Ticket.list();
      let pending;
      if (user.user_type === 'store_manager') {
        const stores = user.assigned_stores || [];
        pending = allTickets.filter(t => t.approval_status === 'pending' && t.store_name && stores.includes(t.store_name));
      } else {
        pending = allTickets.filter(t =>
          t.approval_status === 'pending' &&
          t.approver_email === user.email
        );
      }
      setPendingApprovalCount(pending.length);
    } catch (e) {
      console.error('Error loading pending count:', e);
    }
  };

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      // Not logged in
    }
  };

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = user?.display_name || user?.full_name;

  const isQA = user?.department_name === 'Quality Assurance' || user?.user_type === 'admin';

  let navItems;
  if (user?.user_type === 'store_manager') {
    // Store Managers see a focused set: analytics, approvals, and audit aggregated across all their assigned stores
    navItems = [
      { name: 'Home', icon: LayoutDashboard, page: 'Home' },
      { name: 'Approval Queue', icon: BarChart3, page: 'ApprovalQueue', badge: pendingApprovalCount > 0 ? pendingApprovalCount : null },
      { name: 'Audit', icon: ClipboardList, page: 'Audit' },
    ];
    if (user.assigned_stores?.length) {
      navItems.push({ name: 'My Analytics', icon: BarChart3, page: 'StoreAuditAnalytics' });
      navItems.push({ name: 'Daily Summary', icon: CalendarCheck, page: 'DailySummary' });
      navItems.push({ name: 'Audit Dashboard', icon: BarChart3, page: 'AuditDashboard' });
    }
    navItems.push({ name: 'Manual', icon: BookOpen, page: 'UserManual' });
  } else {
    navItems = [
      { name: 'Home', icon: LayoutDashboard, page: 'Home' },
    ];

    if (user?.user_type === 'approver') {
      navItems.push({
        name: 'Approval Queue',
        icon: BarChart3,
        page: 'ApprovalQueue',
        badge: pendingApprovalCount > 0 ? pendingApprovalCount : null
      });
    }

    if (user?.user_type === 'department_head') {
      navItems.push({ name: 'My Tickets', icon: BarChart3, page: 'DepartmentDashboard' });
      navItems.push({ name: 'Analytics', icon: BarChart3, page: 'DeptAnalytics' });
    }

    if (user?.user_type === 'admin' || user?.user_type === 'department_head') {
      navItems.push({ name: 'Reports', icon: BarChart3, page: 'Reports' });
    }

    if (user?.user_type === 'admin') {
      navItems.push({ name: 'Analytics', icon: BarChart3, page: 'Analytics' });
      navItems.push({ name: 'Daily Summary', icon: CalendarCheck, page: 'DailySummary' });
    }

    if (user?.user_type === 'admin') {
      navItems.push({ name: 'Admin', icon: Settings, page: 'Admin' });
    }

    if (isQA || hasAuditAssignments) {
      navItems.push({ name: 'Audit', icon: ClipboardList, page: 'Audit' });
    }
    if (user?.store_name) {
      navItems.push({ name: 'My Analytics', icon: BarChart3, page: 'StoreAuditAnalytics' });
    }
    if (isQA) {
      navItems.push({ name: 'Store Ranking', icon: Trophy, page: 'StoreRanking' });
      navItems.push({ name: 'Audit Dashboard', icon: BarChart3, page: 'AuditDashboard' });
    }
    navItems.push({ name: 'Manual', icon: BookOpen, page: 'UserManual' });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to={createPageUrl('Home')} className="flex items-center gap-3 group">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6979737791aaf996d5335e29/016378777_TheFigaroCoffeeGroup_logo.png"
                alt="Logo"
                className="h-16 w-auto object-contain"
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-2">
              {navItems.map(item => (
                <Link key={item.page} to={createPageUrl(item.page)}>
                  <Button 
                    variant={currentPageName === item.page ? 'default' : 'ghost'}
                    className={`gap-2 h-11 px-6 font-semibold ${currentPageName === item.page ? 'bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 shadow-md' : 'hover:bg-slate-100'}`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                    {item.badge && (
                      <Badge className="bg-red-500 text-white text-xs h-5 min-w-5 px-1 rounded-full">
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <NotificationBell userEmail={user.email} />
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-3 pl-2 pr-4 h-11 hover:bg-slate-100">
                      <Avatar className="w-9 h-9 ring-2 ring-[#1fd655]">
                        <AvatarFallback className="bg-[#1fd655] text-slate-900 text-sm font-bold">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:block text-sm font-semibold text-slate-900">
                        {user.display_name || user.full_name || user.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="font-medium text-sm">{user.display_name || user.full_name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      {user.department_name && (
                        <p className="text-xs text-blue-600 mt-1">{user.department_name}</p>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                  </>
                  )}

                  {/* Mobile Menu Toggle */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t-2 border-slate-200 bg-white">
            <nav className="p-4 space-y-2">
              {navItems.map(item => (
                <Link 
                  key={item.page} 
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button 
                    variant={currentPageName === item.page ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-3 h-12 font-semibold ${currentPageName === item.page ? 'bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900' : 'hover:bg-slate-100'}`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                    {item.badge && (
                      <Badge className="bg-red-500 text-white text-xs h-5 min-w-5 px-1 rounded-full ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-slate-200 mt-auto bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-sm text-slate-600 font-medium">
            © {new Date().getFullYear()} HelpDesk System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}