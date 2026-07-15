import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock } from 'lucide-react';
import { differenceInHours } from 'date-fns';

const COLORS = ['#1fd655', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];

export default function DeptResolutionChart({ tickets }) {
  const deptMap = {};

  tickets
    .filter(t => (t.status === 'resolved' || t.status === 'closed') && t.resolved_at)
    .forEach(t => {
      const dept = t.department_name || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, count: 0 };
      deptMap[dept].total += differenceInHours(new Date(t.resolved_at), new Date(t.created_date));
      deptMap[dept].count++;
    });

  const data = Object.entries(deptMap)
    .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), count: v.count }))
    .sort((a, b) => a.avg - b.avg);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow text-sm">
        <p className="font-semibold text-slate-800">{payload[0].payload.name}</p>
        <p className="text-blue-600">Avg: <b>{payload[0].value}h</b></p>
        <p className="text-slate-500">{payload[0].payload.count} resolved tickets</p>
      </div>
    );
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-transparent">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Avg Resolution Time by Department (hours)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {data.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">No resolved tickets in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" unit="h" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}