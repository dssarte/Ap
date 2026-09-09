import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gauge } from "lucide-react";
import { differenceInHours } from 'date-fns';
import { safeDate, formatDurationHours } from '@/lib/dateUtils';

const CLOSED_STATUSES = ['closed', 'resolved'];

function hoursBetween(startValue, endValue) {
  const start = safeDate(startValue);
  const end = safeDate(endValue);
  if (!start || !end) return null;
  return differenceInHours(end, start);
}

// Groups tickets by a dimension (department/priority/category) and averages
// response + resolution time per group, so slow/fast outliers are visible
// side by side rather than buried in one overall average.
function buildBreakdown(tickets, keyFn) {
  const groups = {};
  for (const t of tickets) {
    const key = keyFn(t) || 'Unspecified';
    if (!groups[key]) groups[key] = { key, responseTotal: 0, responseCount: 0, resolutionTotal: 0, resolutionCount: 0, total: 0 };
    const group = groups[key];
    group.total += 1;

    const responseHours = hoursBetween(t.created_date, t.first_response_at);
    if (responseHours !== null) {
      group.responseTotal += responseHours;
      group.responseCount += 1;
    }

    if (CLOSED_STATUSES.includes(t.status)) {
      const resolutionHours = hoursBetween(t.created_date, t.resolved_at || t.updated_date);
      if (resolutionHours !== null) {
        group.resolutionTotal += resolutionHours;
        group.resolutionCount += 1;
      }
    }
  }

  return Object.values(groups)
    .map(g => ({
      key: g.key,
      total: g.total,
      avgResponseHours: g.responseCount ? g.responseTotal / g.responseCount : null,
      avgResolutionHours: g.resolutionCount ? g.resolutionTotal / g.resolutionCount : null,
    }))
    .sort((a, b) => (b.avgResolutionHours ?? -1) - (a.avgResolutionHours ?? -1));
}

function BreakdownTable({ title, rows }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title}</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead>Avg Response</TableHead>
              <TableHead>Avg Resolution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-6">No data</TableCell></TableRow>
            ) : rows.map(row => (
              <TableRow key={row.key}>
                <TableCell className="font-medium text-slate-900">{row.key}</TableCell>
                <TableCell>{row.total}</TableCell>
                <TableCell>{row.avgResponseHours !== null ? formatDurationHours(row.avgResponseHours) : '—'}</TableCell>
                <TableCell className="font-semibold">{row.avgResolutionHours !== null ? formatDurationHours(row.avgResolutionHours) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function SpeedInsights({ tickets }) {
  const byDepartment = buildBreakdown(tickets, t => t.department_name);
  const byPriority = buildBreakdown(tickets, t => t.priority);
  const byCategory = buildBreakdown(tickets, t => t.category_name);

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-indigo-500" />
          Resolution Speed Insights
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">Where response and resolution times run slow or fast, so you know why</p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <BreakdownTable title="Department" rows={byDepartment} />
        <BreakdownTable title="Priority" rows={byPriority} />
        <BreakdownTable title="Category" rows={byCategory} />
      </CardContent>
    </Card>
  );
}
