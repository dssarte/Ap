import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, Loader2 } from "lucide-react";

export default function FeedbackModal({ ticket, user, onClose }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const ratingLabels = { 1: 'Very Poor', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Excellent' };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    await base44.entities.TicketFeedback.create({
      ticket_id: ticket.id,
      submitter_email: user.email,
      rating,
      comment: comment.trim(),
      assigned_to: ticket.assigned_to || '',
      department_id: ticket.department_id,
      department_name: ticket.department_name,
      ticket_title: ticket.title,
    });
    setSubmitted(true);
    setSubmitting(false);
    setTimeout(onClose, 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <CheckCircle2 className="w-16 h-16 text-[#1fd655]" />
            <h3 className="text-xl font-bold text-slate-900">Thank you for your feedback!</h3>
            <p className="text-slate-500 text-sm text-center">Your rating helps us improve our support quality.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">Rate Your Support Experience</DialogTitle>
              <p className="text-sm text-slate-500 mt-1">
                Your ticket <span className="font-medium text-slate-700">"{ticket.title}"</span> has been resolved.
                How was your experience?
              </p>
            </DialogHeader>

            <div className="py-4 space-y-6">
              {/* Star Rating */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          star <= (hovered || rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {(hovered || rating) > 0 && (
                  <span className="text-sm font-semibold text-amber-600">
                    {ratingLabels[hovered || rating]}
                  </span>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                  Comments <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Textarea
                  placeholder="Tell us about your experience..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Skip</Button>
              <Button
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit Feedback
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}