import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays, differenceInHours } from 'date-fns';

export default function ResolutionTimeChart({ tickets, dateRange }) {
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  
  // Group by day
  const dailyData = {};
  for (let i = dateRange - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'MMM dd');
    dailyData[date] = { date, total: 0, count: 0 };
  }

  resolvedTickets.forEach(ticket => {
    const date = format(new Date(ticket.updated_date), 'MMM dd');
    if (dailyData[date]) {
      const hours = differenceInHours(new Date(ticket.updated_date), new Date(ticket.created_date));
      dailyData[date].total += hours;
      dailyData[date].count += 1;
    }
  });

  const data = Object.values(dailyData).map(day => ({
    date: day.date,
    avgHours: day.count > 0 ? Math.round(day.total / day.count) : 0
  }));

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-lg font-bold text-slate-900">Average Resolution Time (Hours)</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="avgHours" 
              stroke="#1fd655" 
              strokeWidth={3}
              name="Avg Hours"
              dot={{ fill: '#1fd655', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}