import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, ShieldAlert } from "lucide-react";
import { subDays, differenceInHours } from 'date-fns';
import VolumeChart from '@/components/dept-analytics/VolumeChart';
import StaffResolutionChart from '@/components/dept-analytics/StaffResolutionChart';
import CategoryTrendsChart from '@/components/dept-analytics/CategoryTrendsChart';
import StaffWorkloadTable from '@/components/dept-analytics/StaffWorkloadTable';
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';

const DATE_RANGE_OPTIONS = [
  { value: '1', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

function KPICard({ title, value, sub, color }) {
  return (
    <Card className="border-2 border-slate-200 shadow-md">
      <CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
        <p className={`text-3xl font-bold ${color || 'text-slate-900'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DeptAnalytics() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState('1');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Pre-select own department for dept heads
      if (u?.department_id) setSelectedDept(u.department_id);
    }).catch(() => {}).finally(() => setAuthLoading(false));
  }, []);

  const isAdmin = user?.user_type === 'admin';
  const isDeptHead = user?.user_type === 'department_head';
  const hasAccess = isAdmin || isDeptHead;

  // Departments (admin only — dept head is locked to their dept)
  const { data: departments = [] } = useQuery({
    queryKey: ['analytics-depts'],
    queryFn: () => base44.entities.Department.filter({ is_active: true }),
    enabled: isAdmin,
  });

  // All staff in the selected department
  const { data: staffUsers = [] } = useQuery({
    queryKey: ['analytics-staff', selectedDept],
    queryFn: async () => {
      const all = await base44.entities.User.list();
      return selectedDept ? all.filter(u => u.department_id === selectedDept) : all;
    },
    enabled: !!user,
  });

  // Tickets for the selected department
  const { data: rawTickets = [], isLoading } = useQuery({
    queryKey: ['analytics-tickets', selectedDept],
    queryFn: () =>
      selectedDept
        ? base44.entities.Ticket.filter({ department_id: selectedDept }, '-created_date', 2000)
        : base44.entities.Ticket.list('-created_date', 2000),
    enabled: !!user && hasAccess,
  });

  // Apply date filter client-side
  const tickets = useMemo(() => {
    if (dateRange === 'custom') {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + 'T23:59:59') : new Date();
      return rawTickets.filter(t => {
        const d = new Date(t.created_date);
        return (!from || d >= from) && d <= to;
      });
    }
    const cutoff = subDays(new Date(), parseInt(dateRange));
    return rawTickets.filter(t => new Date(t.created_date) >= cutoff);
  }, [rawTickets, dateRange, customFrom, customTo]);

  // KPIs
  const kpis = useMemo(() => {
    const total = tickets.length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const resRate = total > 0 ? Math.round((resolved.length / total) * 100) : 0;
    const avgHours = resolved.length > 0
      ? Math.round(resolved.reduce((s, t) => {
          if (t.resolved_at && t.created_date) return s + differenceInHours(new Date(t.resolved_at), new Date(t.created_date));
          return s;
        }, 0) / resolved.length)
      : 0;
    const slaBreached = tickets.filter(t => t.sla_resolution_breached).length;
    return { total, resRate, open, avgHours, slaBreached, resolvedCount: resolved.length };
  }, [tickets]);

  const handleExportExcel = () => {
    const rangeLabel = dateRange === 'custom'
      ? `${customFrom || 'Start'} to ${customTo || 'Today'}`
      : (DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || dateRange);
    // Staff workload
    const workload = staffUsers.map(u => {
      const assigned = tickets.filter(t => t.assigned_to === u.email);
      const resolved = assigned.filter(t => t.status === 'resolved' || t.status === 'closed');
      const avgH = resolved.length ? Math.round(resolved.reduce((s, t) => s + (t.resolved_at && t.created_date ? differenceInHours(new Date(t.resolved_at), new Date(t.created_date)) : 0), 0) / resolved.length) : 0;
      return [u.full_name || u.email, u.email, assigned.length, resolved.length, avgH];
    });
    // By category
    const byCategory = Object.values(tickets.reduce((acc, t) => {
      const name = t.category_name || 'Uncategorized';
      if (!acc[name]) acc[name] = { name, total: 0, resolved: 0 };
      acc[name].total++;
      if (t.status === 'resolved' || t.status === 'closed') acc[name].resolved++;
      return acc;
    }, {})).map(d => [d.name, d.total, d.resolved, `${d.total ? Math.round((d.resolved / d.total) * 100) : 0}%`]);

    const sheets = [
      {
        name: 'Summary',
        title: `Department Analytics — ${activeDeptName} · ${rangeLabel}`,
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Tickets', kpis.total],
          ['Open / Active', kpis.open],
          ['Resolved', kpis.resolvedCount],
          ['Resolution Rate', `${kpis.resRate}%`],
          ['Avg Resolution Time', kpis.avgHours > 0 ? `${kpis.avgHours}h` : '—'],
          ['SLA Breached', kpis.slaBreached],
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
        headers: ['Ticket ID', 'Title', 'Category', 'Status', 'Priority', 'Assigned To', 'Submitter', 'Created Date', 'SLA Breached'],
        rows: tickets.map(t => [
          t.id, t.title, t.category_name || '', t.status, t.priority,
          t.assigned_to || 'Unassigned', t.submitter_name || t.submitter_email,
          new Date(t.created_date).toLocaleString(),
          t.sla_resolution_breached ? 'Yes' : 'No',
        ]),
      },
    ];
    exportSheetsToExcel('Department_Analytics', sheets);
  };

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#1fd655]" /></div>;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md border-0 shadow-lg">
          <CardContent className="p-10 text-center">
            <ShieldAlert className="w-14 h-14 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-500">This page is available to department heads and admins only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeDeptName = isAdmin
    ? departments.find(d => d.id === selectedDept)?.name || 'All Departments'
    : user?.department_name || 'Your Department';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1fd655] flex items-center justify-center shadow-md">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            Department Analytics
          </h1>
          <p className="text-slate-500 mt-1 ml-14">{activeDeptName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-[#1fd655]/10 text-slate-700 border border-[#1fd655]/30 font-semibold self-start sm:self-center">
            {tickets.length} tickets in period
          </Badge>
          <ExcelExportButton onClick={handleExportExcel} disabled={tickets.length === 0} />
        </div>
      </div>

      {/* Filters */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          {/* Department filter — admin only */}
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">Department</label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Date Range</label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {dateRange === 'custom' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">From</label>
                <Input type="date" className="h-9 w-36" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">To</label>
                <Input type="date" className="h-9 w-36" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Total Tickets" value={kpis.total} sub="In selected period" color="text-slate-900" />
        <KPICard title="Open / Active" value={kpis.open} sub="Needs attention" color="text-blue-600" />
        <KPICard title="Resolved" value={kpis.resolvedCount} sub={`${kpis.resRate}% resolution rate`} color="text-emerald-600" />
        <KPICard title="Avg Resolution" value={kpis.avgHours > 0 ? `${kpis.avgHours}h` : '—'} sub="Per resolved ticket" color="text-purple-600" />
        <KPICard title="SLA Breached" value={kpis.slaBreached} sub="Resolution SLA" color={kpis.slaBreached > 0 ? 'text-red-600' : 'text-slate-900'} />
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VolumeChart tickets={tickets} dateRange={dateRange} />
            <StaffResolutionChart tickets={tickets} staffUsers={staffUsers} />
          </div>

          <CategoryTrendsChart tickets={tickets} />

          <StaffWorkloadTable tickets={tickets} staffUsers={staffUsers} />
        </div>
      )}
    </div>
  );
}