import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TicketsByAssignee({ tickets }) {
  const assigneeCounts = tickets.reduce((acc, ticket) => {
    const assignee = ticket.assigned_to || 'Unassigned';
    acc[assignee] = (acc[assignee] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(assigneeCounts)
    .map(([email, count]) => ({ 
      name: email === 'Unassigned' ? email : email.split('@')[0], 
      count,
      fullEmail: email
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-lg font-bold text-slate-900">Tickets by Assignee</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white p-2 border border-slate-200 rounded shadow-md">
                    <p className="text-sm font-medium">{payload[0].payload.fullEmail}</p>
                    <p className="text-sm text-slate-600">Tickets: {payload[0].value}</p>
                  </div>
                );
              }
              return null;
            }} />
            <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}