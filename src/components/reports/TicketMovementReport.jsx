import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { safeDate, formatPHDate } from '@/lib/dateUtils';

const CLOSED_STATUSES = ['closed', 'resolved'];
const RESPONDED_PAGE_SIZE = 10;

function daysSince(dateValue) {
  const date = safeDate(dateValue);
  if (!date) return 0;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

// Chunked so a large ticket set doesn't build one oversized `.in(...)` filter.
async function fetchHistoryForTickets(ticketIds) {
  const chunkSize = 150;
  const results = [];
  for (let i = 0; i < ticketIds.length; i += chunkSize) {
    const chunk = ticketIds.slice(i, i + chunkSize);
    const rows = await base44.entities.TicketStatusHistory.filter({ ticket_id: chunk }, '-changed_at', 5000);
    results.push(...rows);
  }
  return results;
}

export function useTicketMovement(tickets) {
  const ticketIds = useMemo(() => tickets.map(t => t.id), [tickets]);

  const { data: historyRows = [], isLoading } = useQuery({
    queryKey: ['ticket-status-history', ticketIds.join(',')],
    queryFn: () => fetchHistoryForTickets(ticketIds),
    enabled: ticketIds.length > 0,
  });

  const historyByTicket = useMemo(() => {
    const map = {};
    for (const row of historyRows) {
      if (!map[row.ticket_id]) map[row.ticket_id] = [];
      map[row.ticket_id].push(row);
    }
    for (const rows of Object.values(map)) {
      rows.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
    }
    return map;
  }, [historyRows]);

  return { historyByTicket, isLoading: isLoading && ticketIds.length > 0 };
}

export function computeTicketMovement(tickets, historyByTicket, responseThresholdDays = 7) {
  const withHistory = tickets.map(t => ({ ticket: t, history: historyByTicket[t.id] || [] }));

  const mostMoving = [...withHistory]
    .filter(({ history }) => history.length > 1)
    .sort((a, b) => b.history.length - a.history.length)
    .slice(0, 10);

  const nonMoving = [...withHistory]
    .filter(({ ticket, history }) => history.length <= 1 && !CLOSED_STATUSES.includes(ticket.status))
    .sort((a, b) => daysSince(b.ticket.created_date) - daysSince(a.ticket.created_date))
    .slice(0, 10);

  const respondedNoMovement = withHistory.filter(({ ticket, history }) => {
    if (!ticket.first_response_at) return false;
    const responseDays = (safeDate(ticket.first_response_at) - safeDate(ticket.created_date)) / (24 * 60 * 60 * 1000);
    if (!(responseDays <= responseThresholdDays)) return false;
    const firstResponseTime = safeDate(ticket.first_response_at)?.getTime();
    const movedAfterResponse = history.some(h => new Date(h.changed_at).getTime() > firstResponseTime);
    return !movedAfterResponse;
  });

  return { mostMoving, nonMoving, respondedNoMovement };
}

const RESPONSE_THRESHOLD_OPTIONS = [
  { value: '7', label: 'Within 1 week' },
  { value: '14', label: 'Within 2 weeks' },
];

export function RespondedNoMovementTable({ tickets, historyByTicket, isLoading, onTicketClick }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [responseThreshold, setResponseThreshold] = useState('7');

  const { respondedNoMovement } = useMemo(
    () => computeTicketMovement(tickets, historyByTicket, parseInt(responseThreshold, 10)),
    [tickets, historyByTicket, responseThreshold]
  );

  // A refetch or filter change can shrink the result set below the current
  // page — snap back to page 1 rather than showing an empty page.
  useEffect(() => {
    setCurrentPage(1);
  }, [tickets, historyByTicket, responseThreshold]);

  const totalPages = Math.ceil(respondedNoMovement.length / RESPONDED_PAGE_SIZE);
  const paginatedTickets = respondedNoMovement.slice(
    (currentPage - 1) * RESPONDED_PAGE_SIZE,
    currentPage * RESPONDED_PAGE_SIZE
  );

  if (isLoading) {
    return (
      <Card className="border-2 border-slate-200 shadow-lg">
        <CardContent className="p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  const thresholdLabel = RESPONSE_THRESHOLD_OPTIONS.find(opt => opt.value === responseThreshold)?.label || 'Within 1 week';

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="text-lg font-bold text-slate-900">Responded {thresholdLabel}, No Movement Since</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Got a first reply within the selected window, but status hasn't changed since</p>
        </div>
        <Select value={responseThreshold} onValueChange={setResponseThreshold}>
          <SelectTrigger className="w-44 border-slate-300 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESPONSE_THRESHOLD_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        {respondedNoMovement.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No tickets matching this</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.map(({ ticket }) => (
                  <TableRow
                    key={ticket.id}
                    onClick={onTicketClick ? () => onTicketClick(ticket) : undefined}
                    className={onTicketClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
                  >
                    <TableCell className="font-medium text-slate-900 max-w-xs truncate">{ticket.title}</TableCell>
                    <TableCell>{ticket.department_name || '—'}</TableCell>
                    <TableCell className="capitalize">{ticket.status?.replace('_', ' ')}</TableCell>
                    <TableCell>{formatPHDate(ticket.first_response_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * RESPONDED_PAGE_SIZE + 1}–{Math.min(currentPage * RESPONDED_PAGE_SIZE, respondedNoMovement.length)} of {respondedNoMovement.length}
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

export default function TicketMovementReport({ tickets, historyByTicket, isLoading, onTicketClick }) {
  const { mostMoving, nonMoving } = useMemo(
    () => computeTicketMovement(tickets, historyByTicket),
    [tickets, historyByTicket]
  );

  if (isLoading) {
    return (
      <Card className="border-2 border-slate-200 shadow-lg">
        <CardContent className="p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-slate-200 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
            Ticket Movement — Top 10
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">Most-changed tickets vs. tickets stuck since creation</p>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Most Moving (most status changes)</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mostMoving.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-slate-400 py-6">No data</TableCell></TableRow>
                  ) : mostMoving.map(({ ticket, history }) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium text-slate-900 max-w-[220px] truncate">{ticket.title}</TableCell>
                      <TableCell className="capitalize">{ticket.status?.replace('_', ' ')}</TableCell>
                      <TableCell className="font-semibold text-blue-600">{history.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Non-Moving (stuck since creation)</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days Stuck</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonMoving.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-slate-400 py-6">No data</TableCell></TableRow>
                  ) : nonMoving.map(({ ticket }) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium text-slate-900 max-w-[220px] truncate">{ticket.title}</TableCell>
                      <TableCell className="capitalize">{ticket.status?.replace('_', ' ')}</TableCell>
                      <TableCell className="font-semibold text-red-600">{Math.floor(daysSince(ticket.created_date))}d</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <RespondedNoMovementTable
        tickets={tickets}
        historyByTicket={historyByTicket}
        isLoading={isLoading}
        onTicketClick={onTicketClick}
      />
    </div>
  );
}
