import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from "lucide-react";
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth } from 'date-fns';

function buildDailyBuckets(tickets, days) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const key = format(subDays(new Date(), i), 'MMM dd');
    buckets[key] = { label: key, created: 0, resolved: 0 };
  }
  tickets.forEach(t => {
    const key = format(new Date(t.created_date), 'MMM dd');
    if (buckets[key]) buckets[key].created++;
    if ((t.status === 'resolved' || t.status === 'closed') && buckets[key]) buckets[key].resolved++;
  });
  return Object.values(buckets);
}

function buildWeeklyBuckets(tickets, weeks) {
  const now = new Date();
  const buckets = {};
  for (let i = weeks - 1; i >= 0; i--) {
    const d = subWeeks(now, i);
    const key = 'W' + format(startOfWeek(d), 'MM/dd');
    buckets[key] = { label: key, created: 0, resolved: 0 };
  }
  tickets.forEach(t => {
    const key = 'W' + format(startOfWeek(new Date(t.created_date)), 'MM/dd');
    if (buckets[key]) {
      buckets[key].created++;
      if (t.status === 'resolved' || t.status === 'closed') buckets[key].resolved++;
    }
  });
  return Object.values(buckets);
}

function buildMonthlyBuckets(tickets, months) {
  const now = new Date();
  const buckets = {};
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = format(startOfMonth(d), 'MMM yyyy');
    buckets[key] = { label: key, created: 0, resolved: 0 };
  }
  tickets.forEach(t => {
    const key = format(startOfMonth(new Date(t.created_date)), 'MMM yyyy');
    if (buckets[key]) {
      buckets[key].created++;
      if (t.status === 'resolved' || t.status === 'closed') buckets[key].resolved++;
    }
  });
  return Object.values(buckets);
}

export default function TicketVolumeChart({ tickets, period, dateRange }) {
  const days = parseInt(dateRange) || 30;

  let data = [];
  if (period === 'weekly') {
    data = buildWeeklyBuckets(tickets, Math.ceil(days / 7));
  } else if (period === 'yearly') {
    data = buildMonthlyBuckets(tickets, Math.ceil(days / 30));
  } else {
    // monthly or custom — use daily if ≤60 days, weekly otherwise
    data = days <= 60 ? buildDailyBuckets(tickets, days) : buildWeeklyBuckets(tickets, Math.ceil(days / 7));
  }

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base font-bold">
          <TrendingUp className="w-5 h-5 text-[#1fd655]" />
          Ticket Volume Over Time
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="created" name="Created" fill="#1fd655" radius={[3, 3, 0, 0]} />
            <Bar dataKey="resolved" name="Resolved" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}