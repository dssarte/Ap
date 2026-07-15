import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Clock } from "lucide-react";
import { format, subWeeks, subMonths, startOfWeek, startOfMonth, differenceInHours } from 'date-fns';

export default function ResolutionTrendChart({ tickets, period, dateRange }) {
  const days = parseInt(dateRange) || 30;
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  const buildBuckets = () => {
    const buckets = {};

    if (period === 'weekly' || days <= 28) {
      const weeks = Math.max(1, Math.ceil(days / 7));
      for (let i = weeks - 1; i >= 0; i--) {
        const key = 'W' + format(startOfWeek(subWeeks(new Date(), i)), 'MM/dd');
        buckets[key] = { label: key, total: 0, count: 0 };
      }
      resolved.forEach(t => {
        const key = 'W' + format(startOfWeek(new Date(t.updated_date)), 'MM/dd');
        if (buckets[key]) {
          buckets[key].total += differenceInHours(new Date(t.updated_date), new Date(t.created_date));
          buckets[key].count++;
        }
      });
    } else {
      const months = Math.max(1, Math.ceil(days / 30));
      for (let i = months - 1; i >= 0; i--) {
        const key = format(startOfMonth(subMonths(new Date(), i)), 'MMM yyyy');
        buckets[key] = { label: key, total: 0, count: 0 };
      }
      resolved.forEach(t => {
        const key = format(startOfMonth(new Date(t.updated_date)), 'MMM yyyy');
        if (buckets[key]) {
          buckets[key].total += differenceInHours(new Date(t.updated_date), new Date(t.created_date));
          buckets[key].count++;
        }
      });
    }

    return Object.values(buckets).map(b => ({
      label: b.label,
      avgHours: b.count > 0 ? Math.round(b.total / b.count) : null,
    }));
  };

  const data = buildBuckets();
  const allValues = data.filter(d => d.avgHours !== null).map(d => d.avgHours);
  const overall = allValues.length ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length) : 0;

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base font-bold">
          <Clock className="w-5 h-5 text-[#1fd655]" />
          Avg Resolution Time (Hours)
          {overall > 0 && (
            <span className="ml-auto text-sm font-normal text-slate-500">Overall avg: {overall}h</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => v !== null ? [`${v}h`, 'Avg Resolution'] : ['No data', '']} />
            {overall > 0 && <ReferenceLine y={overall} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Avg ${overall}h`, position: 'right', fontSize: 10, fill: '#f59e0b' }} />}
            <Line
              type="monotone"
              dataKey="avgHours"
              stroke="#1fd655"
              strokeWidth={2.5}
              dot={{ fill: '#1fd655', r: 4 }}
              connectNulls={false}
              name="Avg Hours"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}