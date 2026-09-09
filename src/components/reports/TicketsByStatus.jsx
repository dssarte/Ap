import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STATUSES = [
  { key: 'open', name: 'OPEN', fill: '#3b82f6' },
  { key: 'in_progress', name: 'IN PROGRESS', fill: '#f59e0b' },
  { key: 'pending', name: 'PENDING', fill: '#a855f7' },
  { key: 'resolved', name: 'RESOLVED', fill: '#10b981' },
  { key: 'closed', name: 'CLOSED', fill: '#64748b' },
];

export default function TicketsByStatus({ tickets }) {
  const statusCounts = tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {});

  const data = STATUSES.map(({ key, name, fill }) => ({
    name,
    count: statusCounts[key] || 0,
    fill
  }));

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-lg font-bold text-slate-900">Tickets by Status</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
