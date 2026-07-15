import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, subDays, eachDayOfInterval, eachWeekOfInterval, endOfWeek } from 'date-fns';

export default function VolumeOverTimeChart({ tickets, dateRange }) {
  const useWeekly = parseInt(dateRange) > 30;
  const now = new Date();
  const start = subDays(now, parseInt(dateRange));

  let data = [];

  if (useWeekly) {
    const weeks = eachWeekOfInterval({ start, end: now });
    data = weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const label = format(weekStart, 'MMM d');
      const created = tickets.filter(t => {
        const d = new Date(t.created_date);
        return d >= weekStart && d <= weekEnd;
      }).length;
      const resolved = tickets.filter(t => {
        const d = t.resolved_at ? new Date(t.resolved_at) : null;
        return d && d >= weekStart && d <= weekEnd;
      }).length;
      return { label, Created: created, Resolved: resolved };
    });
  } else {
    const days = eachDayOfInterval({ start, end: now });
    data = days.map(day => {
      const label = format(day, 'MMM d');
      const dayStr = format(day, 'yyyy-MM-dd');
      const created = tickets.filter(t => t.created_date?.startsWith(dayStr)).length;
      const resolved = tickets.filter(t => t.resolved_at?.startsWith(dayStr)).length;
      return { label, Created: created, Resolved: resolved };
    });
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <b>{p.value}</b>
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#1fd655]" />
          Ticket Volume Over Time {useWeekly ? '(Weekly)' : '(Daily)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1fd655" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1fd655" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Created" stroke="#1fd655" strokeWidth={2} fill="url(#colorCreated)" />
            <Area type="monotone" dataKey="Resolved" stroke="#3b82f6" strokeWidth={2} fill="url(#colorResolved)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}