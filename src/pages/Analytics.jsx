import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, Ticket, Clock, CheckCircle2 } from "lucide-react";
import { subDays, differenceInHours } from 'date-fns';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import ExcelExportButton from "@/components/ExcelExportButton";
import { exportSheetsToExcel } from "@/lib/exportExcel";

const STATUS_COLORS = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  pending: '#a855f7',
  resolved: '#10b981',
  closed: '#64748b',
  pending_approval: '#f97316',
};

const DATE_RANGE_OPTIONS = [
  { value: '1', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

function KPICard({ title, value, sub, icon: Icon, color }) {
  return (
    <Card className="border-2 border-slate-200 shadow-md">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dateRange, setDateRange] = useState('1');

  useEffect(() => {
    base44.auth.me()
      .then(u => setUser(u))
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const hasAccess = user?.user_type === 'admin' || user?.user_type === 'department_head' || user?.user_type === 'store_manager';

  const { data: rawTickets = [], isLoading } = useQuery({
    queryKey: ['analytics-all-tickets'],
    queryFn: () => base44.entities.Ticket.list('-created_date', 2000),
    enabled: !!user && hasAccess,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['analytics-departments'],
    queryFn: () => base44.entities.Department.filter({ is_active: true }),
    enabled: !!user && hasAccess,
  });

  const tickets = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(dateRange));
    // Dept heads only see their department
    let filtered = rawTickets.filter(t => new Date(t.created_date) >= cutoff);
    if (user?.user_type === 'department_head' && user?.department_id) {
      filtered = filtered.filter(t => t.department_id === user.department_id);
    }
    if (user?.user_type === 'store_manager') {
      const stores = user.assigned_stores || [];
      filtered = filtered.filter(t => t.store_name && stores.includes(t.store_name));
    }
    return filtered;
  }, [rawTickets, dateRange, user]);

  // --- Tickets by Status ---
  const statusData = useMemo(() => {
    const counts = {};
    tickets.forEach(t => {
      const label = t.status?.replace('_', ' ') || 'unknown';
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: count,
      color: STATUS_COLORS[status] || '#94a3b8',
    }));
  }, [tickets]);

  // --- Average Resolution Time ---
  const avgResolutionHours = useMemo(() => {
    const resolved = tickets.filter(t => (t.status === 'resolved' || t.status === 'closed') && t.resolved_at && t.created_date);
    if (resolved.length === 0) return null;
    const total = resolved.reduce((s, t) => s + differenceInHours(new Date(t.resolved_at), new Date(t.created_date)), 0);
    return Math.round(total / resolved.length);
  }, [tickets]);

  const formatResolution = (hours) => {
    if (hours === null) return '—';
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d ${hours % 24}h`;
  };

  // --- Volume per Department ---
  const deptData = useMemo(() => {
    const counts = {};
    tickets.forEach(t => {
      const name = t.department_name || 'Unknown';
      if (!counts[name]) counts[name] = { name, total: 0, resolved: 0 };
      counts[name].total++;
      if (t.status === 'resolved' || t.status === 'closed') counts[name].resolved++;
    });
    return Object.values(counts).sort((a, b) => b.total - a.total);
  }, [tickets]);

  const kpis = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    return { total, open, resolved };
  }, [tickets]);

  const handleExportExcel = () => {
    const rangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || dateRange;
    const sheets = [
      {
        name: 'Summary',
        title: `Analytics Overview — ${rangeLabel}`,
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Tickets', kpis.total],
          ['Open / Active', kpis.open],
          ['Resolved', kpis.resolved],
          ['Avg Resolution Time', formatResolution(avgResolutionHours)],
        ],
      },
      {
        name: 'Department Summary',
        headers: ['Department', 'Total', 'Resolved', 'Open', 'Resolution Rate'],
        rows: deptData.map(d => [d.name, d.total, d.resolved, d.total - d.resolved, `${d.total ? Math.round((d.resolved / d.total) * 100) : 0}%`]),
      },
      {
        name: 'By Status',
        headers: ['Status', 'Count'],
        rows: statusData.map(s => [s.name, s.value]),
      },
      {
        name: 'Tickets',
        headers: ['Ticket ID', 'Title', 'Department', 'Category', 'Status', 'Priority', 'Assigned To', 'Submitter', 'Store', 'Created Date'],
        rows: tickets.map(t => [
          t.id, t.title, t.department_name, t.category_name || '',
          t.status, t.priority, t.assigned_to || 'Unassigned',
          t.submitter_name || t.submitter_email, t.store_name || '',
          new Date(t.created_date).toLocaleString(),
        ]),
      },
    ];
    exportSheetsToExcel('Analytics_Overview', sheets);
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

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Operational intelligence</p>
          <h1 className="app-page-heading">Analytics overview</h1>
          <p className="app-page-description">
            {user?.user_type === 'store_manager' ? `Metrics for ${(user.assigned_stores || []).join(', ') || 'your stores'}` : 'System-wide ticket performance metrics'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <ExcelExportButton onClick={handleExportExcel} disabled={tickets.length === 0} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Tickets" value={kpis.total} sub="In selected period" icon={Ticket} color="bg-slate-700" />
        <KPICard title="Open / Active" value={kpis.open} sub="Needs attention" icon={Clock} color="bg-blue-500" />
        <KPICard title="Avg Resolution Time" value={formatResolution(avgResolutionHours)} sub="Per resolved ticket" icon={CheckCircle2} color="bg-emerald-500" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: Status Pie + Dept Bar side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tickets by Status */}
            <Card className="border-2 border-slate-200 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-slate-900">Tickets by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="text-center text-slate-400 py-12 text-sm">No data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={true}
                      >
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'Tickets']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Avg Resolution by Dept */}
            <Card className="border-2 border-slate-200 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-slate-900">Ticket Volume by Department</CardTitle>
              </CardHeader>
              <CardContent>
                {deptData.length === 0 ? (
                  <p className="text-center text-slate-400 py-12 text-sm">No data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={deptData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={30} />
                      <Bar dataKey="total" name="Total" fill="#1fd655" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dept Resolution Table */}
          <Card className="border-2 border-slate-200 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-900">Department Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left px-6 py-3 font-semibold text-slate-600">Department</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">Total</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">Resolved</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">Open</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">Resolution Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptData.map((d, i) => {
                      const open = d.total - d.resolved;
                      const rate = d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0;
                      return (
                        <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-900">{d.name}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700">{d.total}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">{d.resolved}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className="bg-blue-100 text-blue-700 border-0">{open}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-24 bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-[#1fd655] h-2 rounded-full"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-600">{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {deptData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-400">No data for this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
