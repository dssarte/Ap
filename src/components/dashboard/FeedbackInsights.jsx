import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare } from "lucide-react";
import { subDays } from 'date-fns';

function StarBar({ rating, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-4 text-slate-600 font-medium">{rating}</span>
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-slate-500">{count}</span>
    </div>
  );
}

export default function FeedbackInsights({ departmentId, dateRangeDays }) {
  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ['feedback', departmentId, dateRangeDays],
    queryFn: async () => {
      const all = await base44.entities.TicketFeedback.filter({ department_id: departmentId });
      const cutoff = subDays(new Date(), parseInt(dateRangeDays) || 30);
      return all.filter(f => new Date(f.created_date) >= cutoff);
    },
    enabled: !!departmentId,
  });

  const total = feedbacks.length;
  const avg = total > 0 ? (feedbacks.reduce((s, f) => s + f.rating, 0) / total).toFixed(1) : null;
  const dist = [5, 4, 3, 2, 1].map(r => ({ rating: r, count: feedbacks.filter(f => f.rating === r).length }));

  // Per-staff averages
  const staffMap = {};
  feedbacks.forEach(f => {
    if (!f.assigned_to) return;
    if (!staffMap[f.assigned_to]) staffMap[f.assigned_to] = { total: 0, count: 0 };
    staffMap[f.assigned_to].total += f.rating;
    staffMap[f.assigned_to].count++;
  });
  const staffRatings = Object.entries(staffMap)
    .map(([email, v]) => ({ email, avg: (v.total / v.count).toFixed(1), count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  const recentComments = feedbacks.filter(f => f.comment).slice(-5).reverse();

  if (isLoading) return null;

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-transparent">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base font-bold">
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          User Satisfaction & Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {total === 0 ? (
          <p className="text-center text-slate-500 text-sm py-6">No feedback received in this period.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Overall score */}
            <div className="flex flex-col items-center justify-center p-4 bg-amber-50 rounded-xl">
              <div className="text-5xl font-bold text-amber-500">{avg}</div>
              <div className="flex gap-0.5 mt-2">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-5 h-5 ${s <= Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                ))}
              </div>
              <p className="text-sm text-slate-600 mt-2 font-medium">Based on {total} rating{total !== 1 ? 's' : ''}</p>
            </div>

            {/* Distribution */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Distribution</p>
              {dist.map(d => <StarBar key={d.rating} rating={d.rating} count={d.count} total={total} />)}
            </div>

            {/* Staff ratings */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">By Staff Member</p>
              {staffRatings.length === 0 ? (
                <p className="text-sm text-slate-400">No staff-linked ratings</p>
              ) : (
                <div className="space-y-2">
                  {staffRatings.map(s => (
                    <div key={s.email} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 truncate flex-1">{s.email.split('@')[0]}</span>
                      <div className="flex items-center gap-1 ml-2">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-amber-600">{s.avg}</span>
                        <span className="text-slate-400 text-xs">({s.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent comments */}
        {recentComments.length > 0 && (
          <div className="mt-6 border-t pt-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Recent Comments
            </p>
            <div className="space-y-3">
              {recentComments.map(f => (
                <div key={f.id} className="flex gap-3 items-start">
                  <div className="flex gap-0.5 shrink-0 mt-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3 h-3 ${s <= f.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 italic">"{f.comment}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}