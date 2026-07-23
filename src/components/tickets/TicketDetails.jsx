import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Send, Clock, User, Building2, Paperclip, MessageSquare, ArrowRightLeft, Lock, CornerUpLeft } from "lucide-react";
import CannedResponsePicker from "./CannedResponsePicker";
import { formatInTimeZone } from "date-fns-tz";
import SLAIndicator from "./SLAIndicator";
import FeedbackDisplay from "./FeedbackDisplay";
import InternalDiscussion from "./InternalDiscussion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeDate } from "@/lib/dateUtils";
import { getUserDisplayName } from "@/lib/userDisplayName";

const formatTicketDate = (value, pattern) => {
  const date = safeDate(value);
  if (!date) return 'Date unavailable';
  try {
    return formatInTimeZone(date, 'Asia/Manila', pattern);
  } catch {
    return 'Date unavailable';
  }
};

const statusColors = {
  open: "bg-blue-50 text-blue-700 border border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border border-amber-200",
  pending: "bg-purple-50 text-purple-700 border border-purple-200",
  resolved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  closed: "bg-slate-50 text-slate-600 border border-slate-200"
};

const priorityColors = {
  low: "bg-slate-50 text-slate-600 border border-slate-200",
  medium: "bg-blue-50 text-blue-600 border border-blue-200",
  high: "bg-orange-50 text-orange-600 border border-orange-200",
  urgent: "bg-red-50 text-red-600 border border-red-200"
};

export default function TicketDetails({ ticket, user, onClose, onUpdate }) {
  const currentUserDisplayName = getUserDisplayName(user);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState([]);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || '');
  const [allUsers, setAllUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardDeptId, setForwardDeptId] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnNote, setReturnNote] = useState('');
  const [originalDepartment, setOriginalDepartment] = useState(null);
  const [existingFeedback, setExistingFeedback] = useState(null);
  
  const isStaff = user.user_type === 'admin' || user.user_type === 'department_head';
  const isApprover = user.user_type === 'approver';
  const isBranchManager = user.user_type === 'store_manager';
  const canManage = user.user_type === 'admin' || (user.user_type === 'department_head' && user.department_id === ticket.department_id);
  const canReply = isStaff || isApprover || isBranchManager || ticket.submitter_email === user.email;
  // Closed-ticket chat stays available to admins and explicit approvers only.
  // Store managers follow the same closed-ticket lock as department heads and users.
  const canCommentOnClosed = user.user_type === 'admin' || isApprover;

  useEffect(() => {
    loadComments();
    loadUsers();
    loadDepartments();
    loadFeedback();
    loadOriginalDepartment();
  }, [ticket.id]);

  const loadFeedback = async () => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      const results = await base44.entities.TicketFeedback.filter({ ticket_id: ticket.id });
      if (results.length > 0) setExistingFeedback(results[0]);
    }
  };

  const loadComments = async () => {
    let allComments = await base44.entities.TicketComment.filter({ ticket_id: ticket.id });
    
    // Filter internal comments if user is not staff
    if (!isStaff) {
      allComments = allComments.filter(c => !c.is_internal);
    }
    
    setComments(allComments.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
  };

  const loadUsers = async () => {
    if (canManage) {
      const users = await base44.entities.User.list();
      // Admin sees all users, Dept Head sees only users in their department
      if (user.user_type === 'admin') {
        setAllUsers(users);
      } else if (user.user_type === 'department_head') {
        // Filter to only show users in the same department
        const currentUserDeptId = user.department_id;
        const deptUsers = users.filter(u => u.department_id === currentUserDeptId);
        setAllUsers(deptUsers);
      }
    }
  };

  const loadDepartments = async () => {
    if (canManage) {
      const depts = await base44.entities.Department.filter({ is_active: true });
      setDepartments(depts);
    }
  };

  const loadOriginalDepartment = async () => {
    // Load from handling_history to find the previous department
    if (ticket.handling_history && ticket.handling_history.length > 0) {
      // Get the most recent entry (last department that handled it)
      const lastEntry = ticket.handling_history[ticket.handling_history.length - 1];
      setOriginalDepartment({ name: lastEntry.department_name });
    }
  };

  const handleReturnTicket = async () => {
    if (!originalDepartment) return;
    
    // Prevent returning closed tickets unless admin
    if (ticket.status === 'closed' && user.user_type !== 'admin') {
      alert('Closed tickets cannot be returned. Please contact an admin.');
      setShowReturnDialog(false);
      return;
    }
    
    setLoading(true);

    // Find the original department ID
    const originalDept = departments.find(d => d.name === originalDepartment.name);
    if (!originalDept) {
      alert('Original department not found');
      setLoading(false);
      return;
    }

    // Build handling history
    const currentHistory = ticket.handling_history || [];
    const newHistory = [
      ...currentHistory,
      {
        department_id: ticket.department_id,
        department_name: ticket.department_name,
        returned_at: new Date().toISOString(),
        returned_by: currentUserDisplayName,
        return_reason: returnNote
      }
    ];

    // Update ticket department back to original with history
    await base44.entities.Ticket.update(ticket.id, {
      department_id: originalDept.id,
      department_name: originalDept.name,
      handling_department_id: originalDept.id,
      handling_department_name: originalDept.name,
      assigned_to: '',
      handling_history: newHistory
    });

    // Single comment documenting the return
    await base44.entities.TicketComment.create({
      ticket_id: ticket.id,
      content: `↩️ **${ticket.department_name} Department** is returning this ticket to **${originalDept.name} Department**.${returnNote ? `\n\nReason: ${returnNote}` : ''}`,
      author_email: user.email,
      author_name: `${currentUserDisplayName} (${ticket.department_name})`,
      is_internal: false
    });

    // Send notification
    await base44.functions.invoke('sendTicketNotification', {
      ticket_id: ticket.id,
      type: 'updated',
      message: `Ticket returned to ${originalDept.name} department`,
      send_email: true
    });

    setShowReturnDialog(false);
    setReturnNote('');
    setLoading(false);
    onUpdate?.();
    onClose();
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploadingFiles(true);
    const urls = [];
    
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    
    setAttachmentUrls([...attachmentUrls, ...urls]);
    setUploadingFiles(false);
  };

  const removeAttachment = (index) => {
    setAttachmentUrls(attachmentUrls.filter((_, i) => i !== index));
  };

  const handleAddComment = async () => {
    if (!newComment.trim() && attachmentUrls.length === 0) return;
    
    // Admins and explicit approvers keep the public conversation open after
    // closure. Store managers, department heads, and users remain read-only.
    if (ticket.status === 'closed' && !canCommentOnClosed) {
      alert('You cannot comment on this closed ticket.');
      return;
    }
    
    // Approvers can always reply to tickets assigned to them
    
    setLoading(true);
    
    // Mark first response time
    if (!ticket.first_response_at && isStaff) {
      await base44.entities.Ticket.update(ticket.id, {
        first_response_at: new Date().toISOString()
      });
    }
    
    await base44.entities.TicketComment.create({
      ticket_id: ticket.id,
      content: newComment || '(attachment)',
      author_email: user.email,
      author_name: currentUserDisplayName,
      is_internal: isStaff && isInternal,
      attachment_urls: attachmentUrls
    });

    // Send notification
    await base44.functions.invoke('sendTicketNotification', {
      ticket_id: ticket.id,
      type: 'commented',
      message: `${currentUserDisplayName} commented on ticket: ${ticket.title}`,
      send_email: true
    });
    
    setNewComment('');
    setIsInternal(false);
    setAttachmentUrls([]);
    setLoading(false);
    onClose();
  };

  const handleStatusChange = async (newStatus) => {
    // Prevent status change on closed tickets unless admin
    if (ticket.status === 'closed' && user.user_type !== 'admin') {
      alert('Closed tickets cannot be modified. Please contact an admin.');
      return;
    }
    
    setStatus(newStatus);
    
    const updateData = { status: newStatus };
    
    // Mark resolved time when ticket is resolved or closed
    if ((newStatus === 'resolved' || newStatus === 'closed') && !ticket.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
    }
    
    await base44.entities.Ticket.update(ticket.id, updateData);
    
    // Send notification
    await base44.functions.invoke('sendTicketNotification', {
      ticket_id: ticket.id,
      type: 'status_changed',
      message: `Ticket status changed to ${newStatus.replace('_', ' ')}`,
      send_email: true
    });
    
    onUpdate?.();
  };

  const handleAssignmentChange = async (email) => {
    setAssignedTo(email);
    await base44.entities.Ticket.update(ticket.id, { assigned_to: email });
    
    // Send notification
    if (email) {
      await base44.functions.invoke('sendTicketNotification', {
        ticket_id: ticket.id,
        type: 'assigned',
        message: `Ticket has been assigned to you`,
        send_email: true
      });
    }
    
    onUpdate?.();
  };

  const handleForwardTicket = async () => {
    if (!forwardDeptId) return;
    
    // Prevent forwarding closed tickets unless admin
    if (ticket.status === 'closed' && user.user_type !== 'admin') {
      alert('Closed tickets cannot be forwarded. Please contact an admin.');
      setShowForwardDialog(false);
      return;
    }
    
    const targetDept = departments.find(d => d.id === forwardDeptId);
    if (!targetDept) return;

    setLoading(true);

    // Build handling history
    const currentHistory = ticket.handling_history || [];
    const newHistory = [
      ...currentHistory,
      {
        department_id: ticket.department_id,
        department_name: ticket.department_name,
        forwarded_at: new Date().toISOString(),
        forwarded_by: currentUserDisplayName
      }
    ];

    // Update ticket department and history
    await base44.entities.Ticket.update(ticket.id, {
      department_id: targetDept.id,
      department_name: targetDept.name,
      handling_department_id: targetDept.id,
      handling_department_name: targetDept.name,
      assigned_to: '',
      handling_history: newHistory
    });

    // Single comment documenting the forward
    await base44.entities.TicketComment.create({
      ticket_id: ticket.id,
      content: `📤 **${ticket.department_name} Department** has forwarded this ticket to **${targetDept.name} Department**.${forwardNote ? `\n\nMessage: ${forwardNote}` : ''}`,
      author_email: user.email,
      author_name: `${currentUserDisplayName} (${ticket.department_name})`,
      is_internal: false
    });

    // Send notification
    await base44.functions.invoke('sendTicketNotification', {
      ticket_id: ticket.id,
      type: 'updated',
      message: `Ticket forwarded to ${targetDept.name} department`,
      send_email: true
    });

    setShowForwardDialog(false);
    setForwardDeptId('');
    setForwardNote('');
    setLoading(false);
    onUpdate?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <Card className="h-[100dvh] max-h-[100dvh] w-full max-w-2xl overflow-hidden rounded-none border-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:border-2 sm:border-slate-200">
        <CardHeader className="flex flex-row items-start justify-between border-b bg-gradient-to-r from-[#1fd655]/10 to-transparent px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge className={`${priorityColors[ticket.priority]} font-semibold uppercase tracking-wide text-xs`}>
                {ticket.priority}
              </Badge>
              <Badge className={`${statusColors[ticket.status]} font-semibold uppercase tracking-wide text-xs`}>
                {ticket.status?.replace('_', ' ')}
              </Badge>
              {ticket.escalated && (
                <Badge className="bg-red-100 text-red-700 border border-red-300 font-semibold uppercase tracking-wide text-xs">
                  Escalated
                </Badge>
              )}
            </div>
            <SLAIndicator ticket={ticket} />
            <CardTitle className="text-xl font-bold text-slate-900">
              {ticket.title}
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close ticket details">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="max-h-[calc(100dvh-8.5rem)] overflow-y-auto p-0 sm:max-h-[calc(90vh-200px)]">
          <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {ticket.department_name}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {ticket.submitter_name || ticket.submitter_email}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatTicketDate(ticket.created_date, "MMM d, yyyy h:mm a 'PHT'")}
              </span>
            </div>

            {/* Handling History */}
            {ticket.handling_history && ticket.handling_history.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1">
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  Handling History
                </h4>
                <div className="space-y-1">
                  {ticket.handling_history.map((entry, idx) => (
                    <div key={idx} className="text-xs text-amber-900">
                      <span className="font-medium">{entry.department_name}</span>
                      {entry.forwarded_at && (
                        <span> — Forwarded on {formatTicketDate(entry.forwarded_at, "MMM d, h:mm a")} by {entry.forwarded_by}</span>
                      )}
                      {entry.returned_at && (
                        <span> — Returned on {formatTicketDate(entry.returned_at, "MMM d, h:mm a")} by {entry.returned_by}</span>
                      )}
                      {entry.return_reason && (
                        <span className="italic"> ({entry.return_reason})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>
            
            {ticket.attachment_url && (
              <a 
                href={ticket.attachment_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Paperclip className="w-4 h-4" />
                View Attachment
              </a>
            )}

            {ticket.image_urls && ticket.image_urls.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">Images</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ticket.image_urls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img 
                        src={url} 
                        alt={`Ticket image ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-slate-200 hover:border-[#1fd655] transition-colors cursor-pointer"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {/* Feedback display for staff */}
            {(isStaff || isApprover) && existingFeedback && (
              <FeedbackDisplay feedback={existingFeedback} />
            )}

            {canManage && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 font-medium">Status:</span>
                    {ticket.status === 'closed' && user.user_type !== 'admin' ? (
                      <Badge className={`${statusColors[ticket.status]} font-semibold`}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    ) : (
                      <Select value={status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                </div>
                {(ticket.status !== 'closed' || user.user_type === 'admin') && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button 
                      onClick={() => setShowForwardDialog(true)} 
                      variant="outline"
                      className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 sm:w-auto"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Forward to Another Department
                    </Button>
                    {originalDepartment && (
                      <Button 
                        onClick={() => setShowReturnDialog(true)} 
                        variant="outline"
                        className="w-full gap-2 border-amber-200 text-amber-600 hover:bg-amber-50 sm:w-auto"
                      >
                        <CornerUpLeft className="w-4 h-4" />
                        Return to {originalDepartment.name}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <Separator />

            {/* Comments + Internal Discussion tabs */}
            <Tabs defaultValue="comments" className="w-full">
              <TabsList className="w-full bg-slate-100 p-1 rounded-lg mb-3">
                <TabsTrigger value="comments" className="flex-1 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs font-semibold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comments ({comments.filter(c => !c.is_internal).length})
                </TabsTrigger>
                {isStaff && (
                  <TabsTrigger value="internal" className="flex-1 gap-1.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm text-xs font-semibold">
                    <Lock className="w-3.5 h-3.5" />
                    Internal ({comments.filter(c => c.is_internal).length})
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="comments" className="mt-0">
                <div className="space-y-3">
                  {comments.filter(c => !c.is_internal).map(comment => (
                    <div key={comment.id} className="p-3 rounded-lg bg-slate-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-slate-900">
                          {comment.author_name || comment.author_email}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTicketDate(comment.created_date, "MMM d, h:mm a 'PHT'")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{comment.content}</p>
                      {comment.attachment_urls && comment.attachment_urls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {comment.attachment_urls.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">
                              <Paperclip className="w-3 h-3" />Attachment {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {comments.filter(c => !c.is_internal).length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
                  )}
                </div>
              </TabsContent>

              {isStaff && (
                <TabsContent value="internal" className="mt-0 -mx-5 -mb-5">
                  <div style={{ height: 400 }}>
                    <InternalDiscussion ticket={ticket} user={user} staffUsers={allUsers} />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
          
          {canReply && (
            <div className="sticky bottom-0 bg-white border-t p-4">
              {ticket.approval_status === 'rejected' && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700 font-medium">
                    ⚠️ This ticket was rejected: {ticket.rejection_reason}
                  </p>
                </div>
              )}
              {attachmentUrls.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachmentUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs">
                      <Paperclip className="w-3 h-3" />
                      <span>File {idx + 1}</span>
                      <button onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="resize-none"
                    disabled={ticket.status === 'closed' && !canCommentOnClosed}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    id="comment-attachment"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={ticket.status === 'closed' && !canCommentOnClosed}
                  />
                  <label htmlFor="comment-attachment">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={uploadingFiles || (ticket.status === 'closed' && !canCommentOnClosed)}
                      asChild
                    >
                      <span>
                        <Paperclip className="w-4 h-4" />
                      </span>
                    </Button>
                  </label>
                  {isStaff && (
                    <CannedResponsePicker
                      departmentId={ticket.department_id}
                      onSelect={(text) => setNewComment(prev => prev ? prev + '\n' + text : text)}
                    />
                  )}
                  <Button 
                    onClick={handleAddComment} 
                    disabled={loading || uploadingFiles || (!newComment.trim() && attachmentUrls.length === 0) || (ticket.status === 'closed' && !canCommentOnClosed)}
                    size="icon"
                    className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 shadow-md hover:shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forward Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Ticket to Another Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Select Department
              </label>
              <Select value={forwardDeptId} onValueChange={setForwardDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.filter(d => d.id !== ticket.department_id).map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Forward Note (optional)
              </label>
              <Textarea
                placeholder="Add context for the receiving department..."
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForwardDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleForwardTicket} 
              disabled={!forwardDeptId || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Forward Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return Ticket to {originalDepartment?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              This ticket was forwarded from <strong>{originalDepartment?.name} Department</strong>. 
              Returning it will send it back to the original department for further handling.
            </p>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Return Note (optional)
              </label>
              <Textarea
                placeholder="Explain why you're returning this ticket..."
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReturnTicket} 
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <CornerUpLeft className="w-4 h-4 mr-2" />
              Return Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
