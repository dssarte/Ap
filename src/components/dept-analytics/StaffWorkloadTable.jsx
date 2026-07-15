import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { differenceInHours } from 'date-fns';

export default function StaffWorkloadTable({ tickets, staffUsers }) {
  const rows = useMemo(() => {
    const map = {};
    tickets.forEach(t => {
      const email = t.assigned_to;
      if (!email) return;
      if (!map[email]) {
        const u = staffUsers.find(u => u.email === email);
        map[email] = { email, name: u?.full_name || email, open: 0, inProgress: 0, resolved: 0, totalHours: 0, resolvedCount: 0 };
      }
      if (t.status === 'open') map[email].open++;
      else if (t.status === 'in_progress') map[email].inProgress++;
      else if (t.status === 'resolved' || t.status === 'closed') {
        map[email].resolved++;
        map[email].resolvedCount++;
        if (t.resolved_at && t.created_date) {
          map[email].totalHours += differenceInHours(new Date(t.resolved_at), new Date(t.created_date));
        }
      }
    });
    return Object.values(map).sort((a, b) => (b.open + b.inProgress) - (a.open + a.inProgress));
  }, [tickets, staffUsers]);

  const getInitials = name => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getLoadBadge = (open, inProgress) => {
    const active = open + inProgress;
    if (active >= 8) return <Badge className="bg-red-100 text-red-700 border-0 text-xs">High</Badge>;
    if (active >= 4) return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Medium</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Low</Badge>;
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent pb-4">
        <CardTitle className="text-slate-900 text-base">Staff Workload Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No assigned tickets in this period</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100">
                <TableHead className="text-xs">Staff Member</TableHead>
                <TableHead className="text-xs text-center">Open</TableHead>
                <TableHead className="text-xs text-center">In Progress</TableHead>
                <TableHead className="text-xs text-center">Resolved</TableHead>
                <TableHead className="text-xs text-center">Avg Res. Time</TableHead>
                <TableHead className="text-xs text-center">Workload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.email} className="border-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-[#1fd655]/20 text-slate-800 text-xs font-bold">{getInitials(r.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.name}</p>
                        <p className="text-xs text-slate-400">{r.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">{r.open}</TableCell>
                  <TableCell className="text-center font-semibold text-amber-600">{r.inProgress}</TableCell>
                  <TableCell className="text-center font-semibold text-emerald-600">{r.resolved}</TableCell>
                  <TableCell className="text-center text-sm text-slate-600">
                    {r.resolvedCount > 0 ? `${Math.round(r.totalHours / r.resolvedCount)}h` : '—'}
                  </TableCell>
                  <TableCell className="text-center">{getLoadBadge(r.open, r.inProgress)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}