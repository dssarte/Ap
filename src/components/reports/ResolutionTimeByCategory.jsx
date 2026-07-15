import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { differenceInHours } from 'date-fns';

export default function ResolutionTimeByCategory({ tickets }) {
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  
  const categoryTimes = resolvedTickets.reduce((acc, ticket) => {
    const category = ticket.category_name || 'Uncategorized';
    const hours = differenceInHours(new Date(ticket.updated_date), new Date(ticket.created_date));
    
    if (!acc[category]) {
      acc[category] = { total: 0, count: 0 };
    }
    acc[category].total += hours;
    acc[category].count += 1;
    
    return acc;
  }, {});

  const data = Object.entries(categoryTimes)
    .map(([name, { total, count }]) => ({ 
      name, 
      avgHours: Math.round(total / count)
    }))
    .sort((a, b) => b.avgHours - a.avgHours);

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-lg font-bold text-slate-900">Avg Resolution Time by Category</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `${value}h`} />
              <Bar dataKey="avgHours" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-500">
            No resolved tickets to analyze
          </div>
        )}
      </CardContent>
    </Card>
  );
}