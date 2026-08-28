import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, Clock, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { differenceInHours } from "date-fns";
import StatsCard from "@/components/dashboard/StatsCard";
import TicketDetails from "@/components/tickets/TicketDetails";
import { formatPHDate } from "@/lib/dateUtils";

const statusColors = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  pending: 'bg-purple-100 text-purple-700',
  pending_approval: 'bg-amber-100 text-amber-700',
};

export default function DepartmentDashboard() {
  const [user, setUser] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // All tickets for the department (no date filter at fetch — we filter client-side)
  // For department heads: show approved tickets where handling_department_id matches OR assigned to department members OR department appears in handling_history
  const { data: allTickets = [], isLoading } = useQuery({
    queryKey: ['dept-all-tickets', user?.department_id],
    queryFn: async () => {
      if (!user?.department_id) return [];
      // Get all tickets and filter for those assigned to this department
      const all = await base44.entities.Ticket.list('-created_date', 2000);
      return all.filter(t =>
        // Include tickets where handling_department matches OR department appears in history (for forwarded/returned tickets)
        t.approval_status === 'approved' &&
        (
          t.handling_department_id === user.department_id ||
          t.assigned_to === user.email ||
          (t.handling_history && t.handling_history.some(h => h.department_id === user.department_id))
        )
      );
    },
    enabled: !!user?.department_id,
  });

  // Manually-created tickets filed by this department's own users, kept visible
  // here for tracking/monitoring purposes even once they route elsewhere via
  // their category — separate from the handling queue above, which only shows
  // tickets currently routed to this department to act on. Audit-generated
  // tickets are excluded (they always carry an audit_submission_id) since
  // they already show up in the Audit Dashboard for that purpose.
  const { data: filedByDeptTickets = [] } = useQuery({
    queryKey: ['dept-filed-tickets', user?.department_id],
    queryFn: async () => {
      if (!user?.department_id) return [];
      const all = await base44.entities.Ticket.list('-created_date', 2000);
      return all.filter(t =>
        t.department_id === user.department_id &&
        t.handling_department_id !== user.department_id &&
        t.approval_status === 'approved' &&
        !t.audit_submission_id
      );
    },
    enabled: !!user?.department_id,
  });

  const { data: departmentUsers = [] } = useQuery({
    queryKey: ['dept-users', user?.department_id],
    queryFn: async () => {
      const all = await base44.entities.User.list();
      return all.filter(u => u.department_id === user.department_id);
    },
    enabled: !!user?.department_id,
  });

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const openTickets = allTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const closedTickets = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const avgResolutionTime = (() => {
    const resolved = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    if (!resolved.length) return 0;
    const total = resolved.reduce((s, t) => s + differenceInHours(new Date(t.updated_date), new Date(t.created_date)), 0);
    return (total / resolved.length).toFixed(1);
  })();

  const statusChartData = [
    { name: 'Open', value: allTickets.filter(t => t.status === 'open').length },
    { name: 'In Progress', value: allTickets.filter(t => t.status === 'in_progress').length },
    { name: 'Resolved', value: allTickets.filter(t => t.status === 'resolved').length },
    { name: 'Closed', value: allTickets.filter(t => t.status === 'closed').length },
  ];

  const recentTickets = allTickets.slice(0, 10);

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#1fd655]" />
      </div>
    );
  }

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Department workspace</p>
          <h1 className="app-page-heading">My Tickets</h1>
          <p className="app-page-description">{user.department_name}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard title="Open Tickets" value={openTickets} icon={AlertCircle} iconColor="text-blue-600" iconBg="bg-blue-100" />
          <StatsCard title="Closed Tickets" value={closedTickets} icon={CheckCircle2} iconColor="text-green-600" iconBg="bg-green-100" />
          <StatsCard title="Avg Resolution" value={`${avgResolutionTime}h`} icon={Clock} iconColor="text-purple-600" iconBg="bg-purple-100" />
          <StatsCard title="Team Members" value={departmentUsers.length} icon={Users} iconColor="text-[#1fd655]" iconBg="bg-[#1fd655]/10" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-2 border-slate-200 shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <TrendingUp className="w-5 h-5 text-[#1fd655]" /> Tickets by Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1fd655" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Users className="w-5 h-5 text-[#1fd655]" /> Team Members
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-3 max-h-[250px] overflow-y-auto">
                  {departmentUsers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{member.full_name}</p>
                        <p className="text-sm text-slate-600">{member.email}</p>
                      </div>
                      <Badge className={member.user_type === 'department_head' ? 'bg-[#1fd655]/20 text-slate-800 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
                        {member.user_type === 'department_head' ? 'Head' : 'Member'}
                      </Badge>
                    </div>
                  ))}
                  {departmentUsers.length === 0 && <p className="text-center text-slate-500 py-8">No team members</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-slate-200 shadow-xl">
          <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
            <CardTitle className="text-slate-900">Recent Tickets</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : (
              <>
              <div className="space-y-3 md:hidden">
                {recentTickets.map(ticket => (
                  <button key={ticket.id} type="button" onClick={() => setSelectedTicket(ticket)} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 font-semibold text-slate-900">{ticket.title}</p>
                      <Badge className={statusColors[ticket.status] || 'border-0 bg-slate-100 text-slate-600'}>{ticket.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge variant="outline">{ticket.priority}</Badge>
                      <span>{ticket.assigned_to || 'Unassigned'}</span>
                      <span aria-hidden="true">•</span>
                      <time dateTime={ticket.created_date || undefined}>{formatPHDate(ticket.created_date)}</time>
                    </div>
                  </button>
                ))}
                {recentTickets.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No tickets yet</p>}
              </div>
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.map(ticket => (
                    <TableRow
                      key={ticket.id}
                      onDoubleClick={() => setSelectedTicket(ticket)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">{ticket.title}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[ticket.status] || 'bg-slate-100 text-slate-600 border-0'}>
                          {ticket.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline">{ticket.priority}</Badge></TableCell>
                      <TableCell className="text-slate-600">{ticket.assigned_to || 'Unassigned'}</TableCell>
                      <TableCell className="text-slate-600">{formatPHDate(ticket.created_date)}</TableCell>
                    </TableRow>
                  ))}
                  {recentTickets.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No tickets yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200 shadow-xl">
          <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/5 to-transparent">
            <CardTitle className="text-slate-900">Filed by My Department</CardTitle>
            <p className="text-sm text-slate-500">Tickets your own team members created, for tracking — even after routing to another department to be handled.</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3 md:hidden">
              {filedByDeptTickets.map(ticket => (
                <button key={ticket.id} type="button" onClick={() => setSelectedTicket(ticket)} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 font-semibold text-slate-900">{ticket.title}</p>
                    <Badge className={statusColors[ticket.status] || 'border-0 bg-slate-100 text-slate-600'}>{ticket.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{ticket.handling_department_name || 'Unrouted'}</span>
                    <span aria-hidden="true">•</span>
                    <span>{ticket.submitter_name || ticket.submitter_email}</span>
                    <span aria-hidden="true">•</span>
                    <time dateTime={ticket.created_date || undefined}>{formatPHDate(ticket.created_date)}</time>
                  </div>
                </button>
              ))}
              {filedByDeptTickets.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No tickets filed by your department elsewhere yet</p>}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filed By</TableHead>
                    <TableHead>Routed To</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filedByDeptTickets.map(ticket => (
                    <TableRow
                      key={ticket.id}
                      onDoubleClick={() => setSelectedTicket(ticket)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">{ticket.title}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[ticket.status] || 'bg-slate-100 text-slate-600 border-0'}>
                          {ticket.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{ticket.submitter_name || ticket.submitter_email}</TableCell>
                      <TableCell className="text-slate-600">{ticket.handling_department_name || 'Unrouted'}</TableCell>
                      <TableCell className="text-slate-600">{formatPHDate(ticket.created_date)}</TableCell>
                    </TableRow>
                  ))}
                  {filedByDeptTickets.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No tickets filed by your department elsewhere yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Details Modal */}
        {selectedTicket && (
          <TicketDetails
            ticket={selectedTicket}
            user={user}
            onClose={() => setSelectedTicket(null)}
            onUpdate={() => {
              // Refresh will happen automatically via react-query
            }}
          />
        )}
      </div>
    </div>
  );
}
