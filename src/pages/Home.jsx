import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Ticket, Clock, CheckCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import TicketCard from "@/components/tickets/TicketCard";
import TicketForm from "@/components/tickets/TicketForm";
import TicketDetails from "@/components/tickets/TicketDetails";
import StatsCard from "@/components/dashboard/StatsCard";
import FeedbackModal from "@/components/tickets/FeedbackModal";
import { SectionLoadingSkeleton, FeedbackBanner } from '@/components/PageState';

export default function Home() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [feedbackTicket, setFeedbackTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [unreadByTicket, setUnreadByTicket] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadUser();
    loadCategories();
  }, []);

  const loadUser = async () => {
  try {
    const userData = await base44.auth.me();

    if (!userData) {
      throw new Error("User profile was not found.");
    }

    if (!userData.phone || !userData.department_id) {
      window.location.href = "/Register";
      return;
    }

    setUser(userData);
    } catch (error) {
      console.error("Failed to load current user:", error);
      base44.auth.redirectToLogin();
    }
  };

  const loadCategories = async () => {
  try {
    const cats = await base44.entities.Category.filter({
      is_active: true,
    });

    setCategories(Array.isArray(cats) ? cats : []);
    } catch (error) {
      console.error("Failed to load categories:", error);
      setCategories([]);
    }
  };



  const { data: tickets = [], isLoading, isError, error: ticketsError, refetch } = useQuery({
    queryKey: ['tickets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Admin sees all approved tickets
      if (user.user_type === 'admin') {
        const allTickets = await base44.entities.Ticket.list('-created_date');
        return allTickets.filter(t => t.approval_status !== 'pending');
      }
      
      // Department Head sees approved department tickets
      if (user.user_type === 'department_head' && user.department_id) {
        const deptTickets = await base44.entities.Ticket.filter({ department_id: user.department_id }, '-created_date');
        return deptTickets.filter(t => t.approval_status !== 'pending');
      }
      
      // Approver sees tickets they approved (both approved and rejected)
      if (user.user_type === 'approver') {
        const allTickets = await base44.entities.Ticket.list('-created_date');
        return allTickets.filter(t => t.approver_email === user.email);
      }

      // Branch managers see every ticket for their currently assigned stores,
      // including pending, approved, rejected, resolved, and closed tickets.
      if (user.user_type === 'store_manager') {
        const stores = Array.isArray(user.assigned_stores) ? user.assigned_stores : [];
        if (stores.length === 0) return [];
        const assigned = new Set(stores.map(name => String(name).trim().toLowerCase()));
        const visibleTickets = await base44.entities.Ticket.list('-created_date', 2000);
        return visibleTickets.filter(ticket => assigned.has(String(ticket.store_name || '').trim().toLowerCase()));
      }
      
      // Regular user sees all their tickets (including pending approval)
      return base44.entities.Ticket.filter({ submitter_email: user.email }, '-created_date');
    },
    enabled: !!user
  });

  const queryClient = useQueryClient();

  // Ticket-scoped unread indicators replace the global notification bell.
  // A user's own updates are excluded so sending a message never creates an
  // unread badge for the sender.
  useEffect(() => {
    if (!user?.email) {
      setUnreadByTicket({});
      return undefined;
    }

    let active = true;
    const normalizedEmail = user.email.trim().toLowerCase();

    const loadUnreadNotifications = async () => {
      try {
        const notifications = await base44.entities.Notification.filter(
          { user_email: user.email },
          '-created_date',
          2000
        );
        if (!active) return;

        const counts = (Array.isArray(notifications) ? notifications : [])
          .filter(notification => (
            !notification.is_read
            && notification.ticket_id
            && String(notification.created_by || '').trim().toLowerCase() !== normalizedEmail
          ))
          .reduce((result, notification) => {
            result[notification.ticket_id] = (result[notification.ticket_id] || 0) + 1;
            return result;
          }, {});
        setUnreadByTicket(counts);
      } catch (notificationError) {
        console.error('Failed to load ticket updates:', notificationError);
        if (active) setUnreadByTicket({});
      }
    };

    loadUnreadNotifications();
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      const changedRow = event?.new || event?.old || event?.data;
      if (String(changedRow?.user_email || '').trim().toLowerCase() === normalizedEmail) {
        loadUnreadNotifications();
      }
    });

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.email]);

  // Realtime: refetch the ticket list whenever any ticket is created/updated/deleted,
  // so new and changed tickets appear without a manual browser refresh.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Ticket.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['tickets', user.id] });
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [user]);

  const closedStatuses = ['closed', 'resolved'];

  const sortedTickets = [...tickets].sort((a, b) => {
    const aIsClosed = closedStatuses.includes(a.status);
    const bIsClosed = closedStatuses.includes(b.status);
    if (aIsClosed && !bIsClosed) return 1;
    if (!aIsClosed && bIsClosed) return -1;
    const ad = Date.parse(a.created_date || '') || 0;
    const bd = Date.parse(b.created_date || '') || 0;
    return bd - ad;
  });

  const filteredTickets = sortedTickets.filter(ticket => {
    const matchesSearch = ticket.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ticket.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || ticket.category_id === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalPages = Math.ceil(filteredTickets.length / pageSize);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const isStaff = user.user_type === 'admin' || user.user_type === 'department_head';
  const isApprover = user.user_type === 'approver';
  const isBranchManager = user.user_type === 'store_manager';
  const isRegularUser = !isStaff && !isApprover && !isBranchManager;

  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);

    if (unreadByTicket[ticket.id]) {
      setUnreadByTicket(previous => {
        const next = { ...previous };
        delete next[ticket.id];
        return next;
      });

      try {
        const relatedNotifications = await base44.entities.Notification.filter({
          user_email: user.email,
          ticket_id: ticket.id,
        });
        await Promise.all(
          (Array.isArray(relatedNotifications) ? relatedNotifications : [])
            .filter(notification => !notification.is_read)
            .map(notification => base44.entities.Notification.update(notification.id, { is_read: true }))
        );
      } catch (notificationError) {
        console.error('Failed to mark ticket updates as read:', notificationError);
      }
    }

    // Prompt feedback for resolved/closed tickets submitted by this user that haven't been rated
    if (isRegularUser && (ticket.status === 'resolved' || ticket.status === 'closed') && ticket.submitter_email === user.email) {
      const existing = await base44.entities.TicketFeedback.filter({ ticket_id: ticket.id });
      if (existing.length === 0) {
        setFeedbackTicket(ticket);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Ticket workspace</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {isStaff ? 'Support overview' : isApprover ? 'Ticket approvals' : isBranchManager ? 'Branch tickets' : 'My support tickets'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {isStaff
                ? user.user_type === 'admin'
                  ? 'Monitor requests, priorities, and resolution progress across every department.'
                  : `Monitor and coordinate requests assigned to ${user.department_name}.`
                : isBranchManager
                  ? `View and discuss tickets for ${(user.assigned_stores || []).join(', ')}.`
                  : 'Submit requests, follow their progress, and keep every conversation in one place.'}
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="h-11 shrink-0 rounded-xl bg-emerald-700 px-5 font-semibold text-white shadow-sm hover:bg-emerald-800">
            <Plus className="mr-2 h-4 w-4" />
            Create ticket
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatsCard title="Total tickets" value={stats.total} icon={Ticket} color="bg-slate-900" />
          <StatsCard title="Open" value={stats.open} icon={AlertCircle} color="bg-blue-600" />
          <StatsCard title="In progress" value={stats.inProgress} icon={Clock} color="bg-amber-500" />
          <StatsCard title="Resolved" value={stats.resolved} icon={CheckCircle} color="bg-emerald-600" />
        </div>

        {/* Actions */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by title or description"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm shadow-none focus:bg-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white sm:w-44">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white sm:w-48">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tickets List */}
        {isError ? (
          <FeedbackBanner type="error" title="Tickets could not be loaded" actionLabel="Try again" onAction={() => refetch()}>
            {ticketsError?.message || 'Check your connection and try again.'}
          </FeedbackBanner>
        ) : isLoading ? (
          <SectionLoadingSkeleton rows={5} label="Loading tickets" />
        ) : filteredTickets.length > 0 ? (
          <>
            {/* Page size + count */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredTickets.length)} of {filteredTickets.length} tickets
              </p>
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-slate-500 sm:inline">Per page:</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 w-20 rounded-lg border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3">
              {paginatedTickets.map(ticket => (
                <TicketCard 
                  key={ticket.id} 
                  ticket={ticket} 
                  onClick={handleTicketClick}
                  unreadCount={unreadByTicket[ticket.id] || 0}
                />
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? 'bg-emerald-700 text-white hover:bg-emerald-800' : ''}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Ticket className="h-6 w-6 text-slate-400" />
            </div>
            <p className="mb-6 text-base font-medium text-slate-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'No tickets match your search' 
                : 'No tickets yet'}
            </p>
            {!isStaff && (
              <Button onClick={() => setShowForm(true)} className="h-11 rounded-xl bg-emerald-700 px-6 font-semibold text-white hover:bg-emerald-800">
                <Plus className="mr-2 h-4 w-4" />
                Create your first ticket
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg">
            <TicketForm 
              user={user}
              onSuccess={() => {
                setShowForm(false);
                refetch();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {selectedTicket && (
        <TicketDetails
          ticket={selectedTicket}
          user={user}
          onClose={() => setSelectedTicket(null)}
          onUpdate={refetch}
        />
      )}

      {feedbackTicket && !selectedTicket && (
        <FeedbackModal
          ticket={feedbackTicket}
          user={user}
          onClose={() => setFeedbackTicket(null)}
        />
      )}
    </div>
  );
}
