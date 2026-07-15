import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from "lucide-react";
import { format, subDays, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';

export default function VolumeChart({ tickets, dateRange }) {
  const data = useMemo(() => {
    const days = parseInt(dateRange) || 30;
    const now = new Date();
    const from = subDays(now, days);

    if (days <= 14) {
      // Daily
      const days_arr = eachDayOfInterval({ start: from, end: now });
      return days_arr.map(day => {
        const key = format(day, 'MMM d');
        const count = tickets.filter(t => format(new Date(t.created_date), 'MMM d, yyyy') === format(day, 'MMM d, yyyy')).length;
        const resolved = tickets.filter(t =>
          (t.status === 'resolved' || t.status === 'closed') &&
          format(new Date(t.updated_date), 'MMM d, yyyy') === format(day, 'MMM d, yyyy')
        ).length;
        return { name: key, Created: count, Resolved: resolved };
      });
    } else {
      // Weekly
      const weeks = eachWeekOfInterval({ start: from, end: now });
      return weeks.map(weekStart => {
        const weekEnd = subDays(new Date(weekStart.getTime() + 7 * 86400000), 0);
        const key = format(weekStart, 'MMM d');
        const count = tickets.filter(t => {
          const d = new Date(t.created_date);
          return d >= weekStart && d <= weekEnd;
        }).length;
        const resolved = tickets.filter(t => {
          const d = new Date(t.updated_date);
          return (t.status === 'resolved' || t.status === 'closed') && d >= weekStart && d <= weekEnd;
        }).length;
        return { name: key, Created: count, Resolved: resolved };
      });
    }
  }, [tickets, dateRange]);

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base">
          <TrendingUp className="w-4 h-4 text-[#1fd655]" /> Ticket Volume Over Time
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Created" fill="#1fd655" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Resolved" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}