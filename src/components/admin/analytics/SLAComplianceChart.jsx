import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShieldCheck } from 'lucide-react';

export default function SLAComplianceChart({ tickets }) {
  // Per-department SLA compliance
  const deptMap = {};

  tickets.forEach(t => {
    const dept = t.department_name || 'Unknown';
    if (!deptMap[dept]) deptMap[dept] = { compliant: 0, breached: 0 };

    const responseBreach = t.sla_response_breached === true;
    const resolutionBreach = t.sla_resolution_breached === true;

    if (responseBreach || resolutionBreach) {
      deptMap[dept].breached++;
    } else {
      deptMap[dept].compliant++;
    }
  });

  const data = Object.entries(deptMap)
    .map(([name, v]) => {
      const total = v.compliant + v.breached;
      return {
        name,
        Compliant: v.compliant,
        Breached: v.breached,
        rate: total > 0 ? Math.round((v.compliant / total) * 100) : 100,
      };
    })
    .sort((a, b) => b.rate - a.rate);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = (payload[0]?.value || 0) + (payload[1]?.value || 0);
    const rate = total > 0 ? Math.round((payload[0]?.value / total) * 100) : 0;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow text-sm">
        <p className="font-semibold text-slate-800 mb-1">{label}</p>
        <p className="text-emerald-600">✓ Compliant: <b>{payload[0]?.value}</b></p>
        <p className="text-red-500">✗ Breached: <b>{payload[1]?.value}</b></p>
        <p className="text-slate-500 mt-1">Compliance rate: <b>{rate}%</b></p>
      </div>
    );
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-transparent">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          SLA Compliance by Department
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {data.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">No ticket data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Compliant" stackId="a" fill="#1fd655" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Breached" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}