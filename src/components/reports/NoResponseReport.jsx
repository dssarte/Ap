import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { safeDate, formatPHDate } from '@/lib/dateUtils';

const CLOSED_STATUSES = ['closed', 'resolved'];
const THRESHOLD_OPTIONS = [
  { value: '7', label: '1 week (7+ days)' },
  { value: '14', label: '2 weeks (14+ days)' },
];
const PAGE_SIZE = 20;

function daysSince(dateValue) {
  const date = safeDate(dateValue);
  if (!date) return 0;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

export default function NoResponseReport({ tickets, departments = [], stores = [] }) {
  const [thresholdDays, setThresholdDays] = useState('7');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStore, setSelectedStore] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const noResponseTickets = useMemo(() => {
    const threshold = parseInt(thresholdDays, 10);
    return tickets
      .filter(t => !t.first_response_at && !CLOSED_STATUSES.includes(t.status) && daysSince(t.created_date) >= threshold)
      .filter(t => selectedDepartment === 'all' || t.handling_department_id === selectedDepartment)
      .filter(t => selectedStore === 'all' || t.store_name === selectedStore)
      .sort((a, b) => daysSince(b.created_date) - daysSince(a.created_date));
  }, [tickets, thresholdDays, selectedDepartment, selectedStore]);

  // Any filter change can shrink the result set below the current page —
  // snap back to page 1 rather than showing an empty page.
  useEffect(() => {
    setCurrentPage(1);
  }, [thresholdDays, selectedDepartment, selectedStore, tickets]);

  const totalPages = Math.ceil(noResponseTickets.length / PAGE_SIZE);
  const paginatedTickets = noResponseTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            No Response Tickets
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">Open tickets with no staff reply yet</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-44 border-slate-300 h-10">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-44 border-slate-300 h-10">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(store => (
                <SelectItem key={store.id} value={store.store_name}>{store.store_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={thresholdDays} onValueChange={setThresholdDays}>
            <SelectTrigger className="w-48 border-slate-300 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THRESHOLD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {noResponseTickets.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No tickets matching this threshold</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Days Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-slate-900 max-w-xs truncate">{t.title}</TableCell>
                    <TableCell>{t.department_name || '—'}</TableCell>
                    <TableCell className="capitalize">{t.priority}</TableCell>
                    <TableCell>{t.store_name || '—'}</TableCell>
                    <TableCell>{formatPHDate(t.created_date)}</TableCell>
                    <TableCell className="font-semibold text-amber-600">{Math.floor(daysSince(t.created_date))}d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, noResponseTickets.length)} of {noResponseTickets.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function getNoResponseTickets(tickets, thresholdDays) {
  return tickets
    .filter(t => !t.first_response_at && !CLOSED_STATUSES.includes(t.status) && daysSince(t.created_date) >= thresholdDays)
    .sort((a, b) => daysSince(b.created_date) - daysSince(a.created_date));
}
