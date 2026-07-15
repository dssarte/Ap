import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Tags } from "lucide-react";

const COLORS = ['#1fd655', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

export default function CategoryTrendsChart({ tickets }) {
  const data = useMemo(() => {
    const map = {};
    tickets.forEach(t => {
      const cat = t.category_name || 'Uncategorized';
      if (!map[cat]) map[cat] = { name: cat, count: 0, resolved: 0 };
      map[cat].count++;
      if (t.status === 'resolved' || t.status === 'closed') map[cat].resolved++;
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(d => ({ ...d, rate: d.count > 0 ? Math.round((d.resolved / d.count) * 100) : 0 }));
  }, [tickets]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-slate-800 mb-1">{d.name}</p>
        <p className="text-slate-600">Total: <span className="font-bold text-slate-900">{d.count}</span></p>
        <p className="text-slate-600">Resolved: <span className="font-bold text-emerald-600">{d.resolved}</span> ({d.rate}%)</p>
      </div>
    );
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base">
          <Tags className="w-4 h-4 text-[#1fd655]" /> Common Category Trends
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[240px] text-slate-400 text-sm">No category data</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}