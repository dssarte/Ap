import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { format, subDays, eachWeekOfInterval, endOfWeek } from 'date-fns';

export default function SLAComplianceOverTime({ tickets, dateRange }) {
  const now = new Date();
  const start = subDays(now, parseInt(dateRange));
  const weeks = eachWeekOfInterval({ start, end: now });

  const data = weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart);
    const weekTickets = tickets.filter(t => {
      const d = new Date(t.created_date);
      return d >= weekStart && d <= weekEnd;
    });
    const compliant = weekTickets.filter(t => !t.sla_response_breached && !t.sla_resolution_breached).length;
    const total = weekTickets.length;
    return {
      label: format(weekStart, 'MMM d'),
      rate: total > 0 ? Math.round((compliant / total) * 100) : null,
      total,
    };
  }).filter(d => d.total > 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow text-sm">
        <p className="font-semibold text-slate-700">Week of {label}</p>
        <p className="text-emerald-600">Compliance: <b>{payload[0]?.value}%</b></p>
        <p className="text-slate-400">({payload[0]?.payload.total} tickets)</p>
      </div>
    );
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-transparent">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          SLA Compliance Rate Over Time (% weekly)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {data.length < 2 ? (
          <p className="text-center text-slate-400 text-sm py-12">Not enough data for a trend. Try a wider date range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: '90% target', position: 'insideTopRight', fontSize: 11, fill: '#f59e0b' }} />
              <Line type="monotone" dataKey="rate" stroke="#1fd655" strokeWidth={2.5} dot={{ r: 4, fill: '#1fd655' }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}