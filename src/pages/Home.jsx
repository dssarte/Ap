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

export default function Home() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [feedbackTicket, setFeedbackTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
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
      
      // Regular user sees all their tickets (including pending approval)
      return base44.entities.Ticket.filter({ submitter_email: user.email }, '-created_date');
    },
    enabled: !!user
  });

  const queryClient = useQueryClient();

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
  const isRegularUser = !isStaff && !isApprover;

  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);
    // Prompt feedback for resolved/closed tickets submitted by this user that haven't been rated
    if (isRegularUser && (ticket.status === 'resolved' || ticket.status === 'closed') && ticket.submitter_email === user.email) {
      const existing = await base44.entities.TicketFeedback.filter({ ticket_id: ticket.id });
      if (existing.length === 0) {
        setFeedbackTicket(ticket);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            {isStaff ? 'Support Dashboard' : isApprover ? 'Ticket Approvals' : 'My Support Tickets'}
          </h1>
          <p className="text-slate-600 text-lg">
            {isStaff 
              ? user.user_type === 'admin' 
                ? 'Managing all department tickets' 
                : `Managing tickets for ${user.department_name}`
              : 'Track and manage your support requests'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <StatsCard title="Total Tickets" value={stats.total} icon={Ticket} color="bg-[#1fd655]" />
          <StatsCard title="Open" value={stats.open} icon={AlertCircle} color="bg-blue-500" />
          <StatsCard title="In Progress" value={stats.inProgress} icon={Clock} color="bg-amber-500" />
          <StatsCard title="Resolved" value={stats.resolved} icon={CheckCircle} color="bg-emerald-500" />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 bg-white border-2 border-slate-200 h-12 text-base focus:border-[#1fd655]"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-48 bg-white border-2 border-slate-200 h-12 focus:border-[#1fd655]">
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
            <SelectTrigger className="w-full sm:w-48 bg-white border-2 border-slate-200 h-12 focus:border-[#1fd655]">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(true)} className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-12 px-6 shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-5 h-5 mr-2" />
            New Ticket
          </Button>
        </div>

        {/* Tickets List */}
        {isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Tickets could not be loaded.</p>
            <p className="text-sm mt-1">{ticketsError?.message || 'Check Supabase permissions and database schema.'}</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredTickets.length > 0 ? (
          <>
            {/* Page size + count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredTickets.length)} of {filteredTickets.length} tickets
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Per page:</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20 h-9 bg-white border-2 border-slate-200">
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

            <div className="grid gap-4">
              {paginatedTickets.map(ticket => (
                <TicketCard 
                  key={ticket.id} 
                  ticket={ticket} 
                  onClick={handleTicketClick}
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
                    className={currentPage === page ? 'bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900' : ''}
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
          <div className="text-center py-20 bg-white border-2 border-dashed border-slate-300 rounded-2xl">
            <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 text-lg mb-6 font-medium">
              {searchTerm || statusFilter !== 'all' 
                ? 'No tickets match your search' 
                : 'No tickets yet'}
            </p>
            {!isStaff && (
              <Button onClick={() => setShowForm(true)} className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-12 px-8 shadow-lg hover:shadow-xl">
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Ticket
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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