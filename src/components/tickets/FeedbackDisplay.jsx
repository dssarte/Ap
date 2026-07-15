import React from 'react';
import { Star } from "lucide-react";

export default function FeedbackDisplay({ feedback }) {
  if (!feedback) return null;

  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-amber-800">User Feedback</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(s => (
            <Star
              key={s}
              className={`w-4 h-4 ${s <= feedback.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
            />
          ))}
        </div>
        <span className="text-xs text-amber-700 font-medium">({feedback.rating}/5)</span>
      </div>
      {feedback.comment && (
        <p className="text-sm text-amber-900 italic">"{feedback.comment}"</p>
      )}
    </div>
  );
}