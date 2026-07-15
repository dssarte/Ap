import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, Clock, CheckCircle2, AlertCircle, Users, BarChart3, FileText } from "lucide-react";
import { format } from "date-fns";
import { subDays, differenceInHours } from "date-fns";
import StatsCard from "@/components/dashboard/StatsCard";
import ReportFilters from "@/components/dashboard/ReportFilters";
import TicketVolumeChart from "@/components/dashboard/TicketVolumeChart";
import ResolutionTrendChart from "@/components/dashboard/ResolutionTrendChart";
import DeptPerformanceTable from "@/components/dashboard/DeptPerformanceTable";
import ReportExportButton from "@/components/dashboard/ReportExportButton";
import FeedbackInsights from "@/components/dashboard/FeedbackInsights";
import TicketsByStatus from "@/components/reports/TicketsByStatus";
import TicketsByPriority from "@/components/reports/TicketsByPriority";
import TicketDetails from "@/components/tickets/TicketDetails";
import ExcelExportButton from "@/components/ExcelExportButton";
import { exportSheetsToExcel } from "@/lib/exportExcel";

const statusColors = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  pending: 'bg-purple-100 text-purple-700',
  pending_approval: 'bg-amber-100 text-amber-700',
};

const DEFAULT_FILTERS = {
  period: 'monthly',
  dateRange: '1',
  department: 'all',
  category: 'all',
  staff: 'all',
  customFrom: '',
  customTo: '',
};

export default function DepartmentDashboard() {
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
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

  const { data: departmentUsers = [] } = useQuery({
    queryKey: ['dept-users', user?.department_id],
    queryFn: async () => {
      const all = await base44.entities.User.list();
      return all.filter(u => u.department_id === user.department_id);
    },
    enabled: !!user?.department_id,
  });

  // ── Apply report filters ─────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    let cutoff;
    if (filters.period === 'custom') {
      const from = filters.customFrom ? new Date(filters.customFrom) : null;
      const to = filters.customTo ? new Date(filters.customTo + 'T23:59:59') : new Date();
      return allTickets.filter(t => {
        const d = new Date(t.created_date);
        return (!from || d >= from) && d <= to;
      });
    } else {
      cutoff = subDays(new Date(), parseInt(filters.dateRange) || 30);
    }

    return allTickets.filter(t => {
      const d = new Date(t.created_date);
      if (d < cutoff) return false;
      if (filters.category !== 'all' && t.category_name !== filters.category) return false;
      if (filters.staff !== 'all' && t.assigned_to !== filters.staff) return false;
      return true;
    });
  }, [allTickets, filters]);

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

  // ── Derive filter options from tickets ───────────────────────────────────────
  const categories = useMemo(() => [...new Set(allTickets.map(t => t.category_name).filter(Boolean))], [allTickets]);
  const staffOptions = useMemo(() => {
    const emails = [...new Set(allTickets.map(t => t.assigned_to).filter(Boolean))];
    return emails.map(email => {
      const u = departmentUsers.find(u => u.email === email);
      return { email, full_name: u?.full_name || email };
    });
  }, [allTickets, departmentUsers]);

  // ── Report summary stats ─────────────────────────────────────────────────────
  const reportTotal = filteredTickets.length;
  const reportResolved = filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const reportAvgRes = (() => {
    const r = filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    if (!r.length) return 0;
    return Math.round(r.reduce((s, t) => s + differenceInHours(new Date(t.updated_date), new Date(t.created_date)), 0) / r.length);
  })();
  const reportSLABreached = filteredTickets.filter(t => t.sla_resolution_breached).length;

  const handleExportExcel = () => {
    const periodLabel = filters.period === 'custom'
      ? `${filters.customFrom || 'Start'} to ${filters.customTo || 'Today'}`
      : `Last ${filters.dateRange} Days`;
    const workload = departmentUsers.map(u => {
      const assigned = filteredTickets.filter(t => t.assigned_to === u.email);
      const resolved = assigned.filter(t => t.status === 'resolved' || t.status === 'closed');
      const avgH = resolved.length ? Math.round(resolved.reduce((s, t) => s + differenceInHours(new Date(t.updated_date), new Date(t.created_date)), 0) / resolved.length) : 0;
      return [u.full_name || u.email, u.email, assigned.length, resolved.length, avgH];
    });
    const byCategory = Object.values(filteredTickets.reduce((acc, t) => {
      const name = t.category_name || 'Uncategorized';
      if (!acc[name]) acc[name] = { name, total: 0, resolved: 0 };
      acc[name].total++;
      if (t.status === 'resolved' || t.status === 'closed') acc[name].resolved++;
      return acc;
    }, {})).map(d => [d.name, d.total, d.resolved, `${d.total ? Math.round((d.resolved / d.total) * 100) : 0}%`]);

    const sheets = [
      {
        name: 'Summary',
        title: `Department Dashboard — ${user.department_name} · ${periodLabel}`,
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Tickets', reportTotal],
          ['Resolved', reportResolved],
          ['Resolution Rate', `${reportTotal ? Math.round((reportResolved / reportTotal) * 100) : 0}%`],
          ['Avg Resolution Time', `${reportAvgRes}h`],
          ['SLA Breached', reportSLABreached],
        ],
      },
      {
        name: 'Staff Workload',
        headers: ['Staff Member', 'Email', 'Assigned', 'Resolved', 'Avg Resolution (h)'],
        rows: workload,
      },
      {
        name: 'By Category',
        headers: ['Category', 'Total', 'Resolved', 'Resolution Rate'],
        rows: byCategory,
      },
      {
        name: 'Tickets',
        headers: ['Ticket ID', 'Title', 'Category', 'Status', 'Priority', 'Assigned To', 'Submitter', 'Created Date', 'SLA Response Breached', 'SLA Resolution Breached'],
        rows: filteredTickets.map(t => [
          t.id, t.title, t.category_name || '', t.status, t.priority,
          t.assigned_to || 'Unassigned', t.submitter_name || t.submitter_email,
          format(new Date(t.created_date), 'yyyy-MM-dd HH:mm'),
          t.sla_response_breached ? 'Yes' : 'No',
          t.sla_resolution_breached ? 'Yes' : 'No',
        ]),
      },
    ];
    exportSheetsToExcel('Department_Dashboard', sheets);
  };

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
          <h1 className="app-page-heading">My tickets</h1>
          <p className="app-page-description">{user.department_name}</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="app-tabs-list">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-5 h-10 gap-2">
            <BarChart3 className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-5 h-10 gap-2">
            <FileText className="w-4 h-4" /> Historical Reports
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
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
                        <TableCell className="text-slate-600">{format(new Date(ticket.created_date), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                    {recentTickets.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No tickets yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
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
        </TabsContent>

        {/* ── REPORTS TAB ─────────────────────────────────────────────────────── */}
        <TabsContent value="reports" className="space-y-6">
          {/* Filters */}
          <ReportFilters
            filters={filters}
            onChange={setFilters}
            categories={categories}
            staff={staffOptions}
            showDepartments={false}
          />

          {/* Report Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard title="Total Tickets" value={reportTotal} icon={BarChart3} iconColor="text-[#1fd655]" iconBg="bg-[#1fd655]/10" subtitle="In selected period" />
            <StatsCard title="Resolved" value={reportResolved} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-100" subtitle={`${reportTotal ? Math.round((reportResolved / reportTotal) * 100) : 0}% rate`} />
            <StatsCard title="Avg Resolution" value={`${reportAvgRes}h`} icon={Clock} iconColor="text-blue-600" iconBg="bg-blue-100" subtitle="Average time" />
            <StatsCard title="SLA Breached" value={reportSLABreached} icon={AlertCircle} iconColor="text-red-500" iconBg="bg-red-100" subtitle="Resolution SLA" />
          </div>

          {/* Export */}
          <div className="flex justify-end gap-3">
            <ReportExportButton
              tickets={filteredTickets}
              filters={filters}
              departmentName={user.department_name}
            />
            <ExcelExportButton onClick={handleExportExcel} disabled={filteredTickets.length === 0} />
          </div>

          {/* Charts */}
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TicketVolumeChart tickets={filteredTickets} period={filters.period} dateRange={filters.dateRange} />
                <ResolutionTrendChart tickets={filteredTickets} period={filters.period} dateRange={filters.dateRange} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TicketsByStatus tickets={filteredTickets} />
                <TicketsByPriority tickets={filteredTickets} />
              </div>

              <DeptPerformanceTable tickets={filteredTickets} staff={departmentUsers} />

              <FeedbackInsights departmentId={user?.department_id} dateRangeDays={filters.dateRange} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
