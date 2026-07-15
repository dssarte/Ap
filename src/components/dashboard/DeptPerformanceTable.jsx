import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function DeptPerformanceTable({ tickets, staff }) {
  const staffMap = {};

  (staff || []).forEach(s => {
    staffMap[s.email] = { name: s.full_name || s.email, assigned: 0, resolved: 0, totalHours: 0 };
  });

  tickets.forEach(t => {
    if (!t.assigned_to) return;
    if (!staffMap[t.assigned_to]) {
      staffMap[t.assigned_to] = { name: t.assigned_to, assigned: 0, resolved: 0, totalHours: 0 };
    }
    staffMap[t.assigned_to].assigned++;
    if (t.status === 'resolved' || t.status === 'closed') {
      staffMap[t.assigned_to].resolved++;
      const h = (new Date(t.updated_date) - new Date(t.created_date)) / 3600000;
      staffMap[t.assigned_to].totalHours += h;
    }
  });

  const rows = Object.values(staffMap).filter(r => r.assigned > 0).sort((a, b) => b.assigned - a.assigned);

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base font-bold">
          <Users className="w-5 h-5 text-[#1fd655]" />
          Staff Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">No assigned tickets in this period</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Staff Member</TableHead>
                <TableHead className="font-semibold text-center">Assigned</TableHead>
                <TableHead className="font-semibold text-center">Resolved</TableHead>
                <TableHead className="font-semibold text-center">Resolution Rate</TableHead>
                <TableHead className="font-semibold text-center">Avg Resolution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const rate = r.assigned > 0 ? Math.round((r.resolved / r.assigned) * 100) : 0;
                const avgH = r.resolved > 0 ? Math.round(r.totalHours / r.resolved) : null;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-slate-900">{r.name}</TableCell>
                    <TableCell className="text-center">{r.assigned}</TableCell>
                    <TableCell className="text-center">{r.resolved}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={rate >= 80 ? 'bg-green-100 text-green-700 border-0' : rate >= 50 ? 'bg-yellow-100 text-yellow-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                        {rate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-slate-600">{avgH !== null ? `${avgH}h` : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}