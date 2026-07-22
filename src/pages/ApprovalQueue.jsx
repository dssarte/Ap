import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Loader2, FileText, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInTimeZone } from 'date-fns-tz';

const formatPHT = (value, pattern = "MMM d, yyyy h:mm a 'PHT'") => {
  if (!value) return 'Date unavailable';
  const raw = String(value);
  const date = new Date(raw.endsWith('Z') || /[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  try { return formatInTimeZone(date, 'Asia/Manila', pattern); }
  catch { return 'Date unavailable'; }
};
import StatsCard from "@/components/dashboard/StatsCard";
import { SectionLoadingSkeleton, FeedbackBanner } from '@/components/PageState';
import { useToast } from '@/components/ui/use-toast';

export default function ApprovalQueue() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'approve' or 'reject'
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      base44.auth.redirectToLogin();
    }
  };

  const { data: tickets = [], isLoading, error: ticketsError, refetch } = useQuery({
    queryKey: ['approval-tickets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      if (user.user_type === 'store_manager') {
        const stores = user.assigned_stores || [];
        return stores.length
          ? base44.entities.Ticket.filter({ store_name: stores }, '-created_date', 1000)
          : [];
      }
      return base44.entities.Ticket.filter({ approver_email: user.email }, '-created_date', 1000);
    },
    enabled: !!user
  });

  const queryClient = useQueryClient();

  // Realtime: refetch the approval queue whenever any ticket changes,
  // so new pending tickets (incl. auto-tickets from audits) appear without a refresh.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Ticket.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['approval-tickets', user.id] });
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [user]);

  const handleConfirm = (action) => {
    setConfirmAction(action);
    setShowConfirmDialog(true);
  };

  const handleConfirmYes = async () => {
    setShowConfirmDialog(false);
    if (confirmAction === 'approve') {
      await handleApprove(selectedTicket);
    } else if (confirmAction === 'reject') {
      setShowRejectDialog(true);
    }
    setConfirmAction(null);
  };

  const handleApprove = async (ticket) => {
    setProcessing(true);
    try {
      await base44.tickets.processApproval(ticket.id, 'approve');
      await refetch();
      setSelectedTicket(null);
      toast({ title: 'Ticket approved', description: 'The ticket has been routed to the responsible department.' });
    } catch (error) {
      toast({ title: 'Approval failed', description: error?.message || 'The ticket could not be approved. Please try again.', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: 'Rejection reason required', description: 'Enter a reason before rejecting this ticket.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      await base44.tickets.processApproval(selectedTicket.id, 'reject', rejectionReason);

      await refetch();
      setSelectedTicket(null);
      setShowRejectDialog(false);
      setRejectionReason('');
      toast({ title: 'Ticket rejected', description: 'The requester can now review the rejection reason.' });
    } catch (error) {
      toast({ title: 'Rejection failed', description: error?.message || 'The ticket could not be rejected. Please try again.', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const priorityColors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  const loadComments = async (ticketId) => {
    const ticketComments = await base44.entities.TicketComment.filter({ ticket_id: ticketId }, '-created_date');
    setComments(ticketComments);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setAddingComment(true);
    try {
      await base44.entities.TicketComment.create({
        ticket_id: selectedTicket.id,
        content: newComment,
        author_email: user.email,
        author_name: user.full_name,
        is_internal: false
      });
      
      setNewComment('');
      await loadComments(selectedTicket.id);
      toast({ title: 'Comment added' });
    } catch (error) {
      toast({ title: 'Comment failed', description: error?.message || 'The comment could not be added.', variant: 'destructive' });
    } finally {
      setAddingComment(false);
    }
  };

  useEffect(() => {
    if (selectedTicket) {
      loadComments(selectedTicket.id);
    }
  }, [selectedTicket]);

  // Realtime: live-update comments while a ticket is open.
  useEffect(() => {
    const unsubscribe = base44.entities.TicketComment.subscribe(() => {
      if (selectedTicket) loadComments(selectedTicket.id);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [selectedTicket]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const pendingTickets = tickets.filter(t => t.approval_status === 'pending');
  const approvedTickets = tickets.filter(t => t.approval_status === 'approved');
  const rejectedTickets = tickets.filter(t => t.approval_status === 'rejected');

  const stats = {
    pending: pendingTickets.length,
    approved: approvedTickets.length,
    rejected: rejectedTickets.length
  };

  return (
    <div className="app-page-shell">
      <div className="app-page">
        <div className="app-page-header">
          <div>
            <p className="app-page-eyebrow">Request governance</p>
            <h1 className="app-page-heading">Approval queue</h1>
            <p className="app-page-description">Review and approve pending ticket requests.</p>
          </div>
          {!isLoading && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <Clock className="w-5 h-5 text-amber-500" />
              <span className="text-amber-800 font-semibold text-lg">{stats.pending}</span>
              <span className="text-amber-700 text-sm font-medium">ticket{stats.pending !== 1 ? 's' : ''} awaiting approval</span>
            </div>
          )}
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatsCard title="Pending Approval" value={stats.pending} icon={Clock} color="bg-amber-500" />
          <StatsCard title="Approved" value={stats.approved} icon={CheckCircle} color="bg-[#1fd655]" />
          <StatsCard title="Rejected" value={stats.rejected} icon={XCircle} color="bg-red-500" />
        </div>

        {ticketsError ? (
          <FeedbackBanner type="error" title="Unable to load the approval queue">
            {ticketsError.message || 'Please check your connection and try again.'}
          </FeedbackBanner>
        ) : isLoading ? (
          <SectionLoadingSkeleton rows={4} label="Loading approval requests" />
        ) : (
          <Tabs defaultValue="pending">
            <TabsList className="app-tabs-list">
              <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
            </TabsList>

            {[
              { key: 'pending', list: pendingTickets },
              { key: 'approved', list: approvedTickets },
              { key: 'rejected', list: rejectedTickets }
            ].map(({ key, list }) => (
              <TabsContent key={key} value={key}>
                {list.length > 0 ? (
                  <div className="grid gap-4">
                    {list.map(ticket => (
                      <Card key={ticket.id} className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-slate-200" onClick={() => setSelectedTicket(ticket)}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <CardTitle className="text-xl mb-2">{ticket.title}</CardTitle>
                              <div className="flex flex-wrap gap-2 mb-3">
                                <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                                <Badge variant="outline">{ticket.department_name}</Badge>
                                {ticket.category_name && <Badge variant="outline">{ticket.category_name}</Badge>}
                                {ticket.approval_status === 'approved' && <Badge className="bg-green-100 text-green-700">Approved</Badge>}
                                {ticket.approval_status === 'rejected' && <Badge className="bg-red-100 text-red-700">Rejected</Badge>}
                              </div>
                              <p className="text-sm text-slate-600 line-clamp-2">{ticket.description}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-slate-500">
                              By {ticket.submitter_name} • {formatPHT(ticket.created_date)}
                            </span>
                            <Button onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }} className="w-full bg-[#1fd655] text-slate-900 hover:bg-[#1bd64d] sm:w-auto">
                              {key === 'pending' ? 'Review' : 'View & Chat'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white border-2 border-dashed border-slate-300 rounded-2xl">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 text-lg font-medium">No {key} tickets</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Ticket Review Dialog */}
      {selectedTicket && !showRejectDialog && (
        <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open && !addingComment) setSelectedTicket(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedTicket.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={priorityColors[selectedTicket.priority]}>{selectedTicket.priority} Priority</Badge>
                <Badge variant="outline">{selectedTicket.department_name}</Badge>
                {selectedTicket.category_name && <Badge variant="outline">{selectedTicket.category_name}</Badge>}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Submitted By:</span>
                  <p className="font-medium">{selectedTicket.submitter_name}</p>
                  <p className="text-slate-600">{selectedTicket.submitter_email}</p>
                </div>
                <div>
                  <span className="text-slate-500">Date:</span>
                  <p className="font-medium">{formatPHT(selectedTicket.created_date)}</p>
                </div>
              </div>

              {selectedTicket.image_urls?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Attachments</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTicket.image_urls.map((url, idx) => (
                      <img key={idx} src={url} alt={`Attachment ${idx + 1}`} className="rounded border" />
                    ))}
                  </div>
                </div>
              )}

              {selectedTicket.approval_status === 'rejected' && selectedTicket.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h3 className="font-semibold text-red-800 mb-1">Rejection Reason:</h3>
                  <p className="text-sm text-red-700">{selectedTicket.rejection_reason}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comments & Notes
                </h3>
                
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-900">{comment.author_name}</span>
                          <span className="text-xs text-slate-500">{formatPHT(comment.created_date, "MMM d, h:mm a 'PHT'")}</span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a comment or note..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1"
                    rows={2}
                  />
                  <Button 
                    onClick={handleAddComment} 
                    disabled={addingComment || !newComment.trim()}
                    className="self-end"
                  >
                    {addingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedTicket(null)} disabled={processing}>
                Close
              </Button>
              {selectedTicket.approval_status === 'pending' && (
                <>
                  <Button variant="destructive" onClick={() => handleConfirm('reject')} disabled={processing}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => handleConfirm('approve')} disabled={processing} className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900">
                    {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Approve
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Action Dialog */}
      {showConfirmDialog && (
        <Dialog open={showConfirmDialog} onOpenChange={() => { setShowConfirmDialog(false); setConfirmAction(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {confirmAction === 'approve' ? 'Approve Ticket' : 'Reject Ticket'}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Are you sure you want to <strong>{confirmAction}</strong> this ticket? Do you want to continue?
            </p>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowConfirmDialog(false); setConfirmAction(null); }}>
                No
              </Button>
              <Button
                onClick={handleConfirmYes}
                className={confirmAction === 'approve' ? 'bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900' : 'bg-red-600 hover:bg-red-700 text-white'}
              >
                Yes, Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <Dialog open={showRejectDialog} onOpenChange={() => { setShowRejectDialog(false); setRejectionReason(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Please provide a reason for rejecting this ticket:</p>
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectionReason(''); }} disabled={processing}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={processing || !rejectionReason.trim()}>
                {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
