import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function UserWorkloadChart({ tickets }) {
  const userCounts = tickets.reduce((acc, ticket) => {
    const user = ticket.submitter_name || ticket.submitter_email || 'Unknown';
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(userCounts)
    .map(([name, count]) => ({ name: name.split(' ')[0] || name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 users

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-lg font-bold text-slate-900">Top Users by Tickets</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}