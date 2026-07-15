import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Users } from "lucide-react";
import { differenceInHours } from 'date-fns';

const COLORS = ['#1fd655', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export default function StaffResolutionChart({ tickets, staffUsers }) {
  const data = useMemo(() => {
    const staffMap = {};
    tickets.forEach(t => {
      if (!t.assigned_to) return;
      if (!staffMap[t.assigned_to]) {
        const user = staffUsers.find(u => u.email === t.assigned_to);
        staffMap[t.assigned_to] = {
          name: user?.full_name || t.assigned_to.split('@')[0],
          total: 0, resolved: 0, totalHours: 0,
        };
      }
      staffMap[t.assigned_to].total++;
      if (t.status === 'resolved' || t.status === 'closed') {
        staffMap[t.assigned_to].resolved++;
        if (t.resolved_at && t.created_date) {
          staffMap[t.assigned_to].totalHours += differenceInHours(
            new Date(t.resolved_at), new Date(t.created_date)
          );
        }
      }
    });

    return Object.values(staffMap).map(s => ({
      name: s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name,
      fullName: s.name,
      avgHours: s.resolved > 0 ? Math.round(s.totalHours / s.resolved) : 0,
      resolved: s.resolved,
      total: s.total,
    })).sort((a, b) => a.avgHours - b.avgHours);
  }, [tickets, staffUsers]);

  const overall = useMemo(() => {
    if (!data.length) return 0;
    return Math.round(data.reduce((s, d) => s + d.avgHours, 0) / data.length);
  }, [data]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-slate-800 mb-1">{d.fullName}</p>
        <p className="text-slate-600">Avg Resolution: <span className="font-bold text-slate-900">{d.avgHours}h</span></p>
        <p className="text-slate-600">Resolved: <span className="font-bold text-emerald-600">{d.resolved}</span> / {d.total}</p>
      </div>
    );
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base">
          <Users className="w-4 h-4 text-[#1fd655]" /> Avg Resolution Time per Staff
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[240px] text-slate-400 text-sm">No assigned ticket data</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={overall} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Avg ${overall}h`, position: 'top', fontSize: 10, fill: '#ef4444' }} />
              <Bar dataKey="avgHours" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}