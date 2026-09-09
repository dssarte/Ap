import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, TrendingUp, Clock, Users, ShieldAlert, Timer } from "lucide-react";
import { format, subDays, differenceInHours } from "date-fns";
import StatsCard from "@/components/dashboard/StatsCard";
import TicketsByDepartment from "@/components/reports/TicketsByDepartment";
import TicketsByStatus from "@/components/reports/TicketsByStatus";
import TicketsByPriority from "@/components/reports/TicketsByPriority";
import ResolutionTimeChart from "@/components/reports/ResolutionTimeChart";
import UserWorkloadChart from "@/components/reports/UserWorkloadChart";
import ResolutionTimeByCategory from "@/components/reports/ResolutionTimeByCategory";
import ExportButton from "@/components/reports/ExportButton";
import FeedbackInsights from "@/components/dashboard/FeedbackInsights";
import ExcelExportButton from "@/components/ExcelExportButton";
import { exportSheetsToExcel } from "@/lib/exportExcel";
import { formatDurationHours } from "@/lib/dateUtils";
import NoResponseReport, { getNoResponseTickets } from "@/components/reports/NoResponseReport";
import SpeedInsights from "@/components/reports/SpeedInsights";
import TicketMovementReport, { useTicketMovement, computeTicketMovement } from "@/components/reports/TicketMovementReport";

export default function Reports() {
  const [user, setUser] = useState(null);
  const [dateRange, setDateRange] = useState('1'); // days (default: today only)
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [stores, setStores] = useState([]);

  useEffect(() => {
    loadUser();
    loadDepartments();
    loadStores();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const loadDepartments = async () => {
    const depts = await base44.entities.Department.list();
    setDepartments(depts);
  };

  const loadStores = async () => {
    const activeStores = await base44.entities.Store.filter({ is_active: true });
    setStores(activeStores);
  };

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['reports-tickets', dateRange, selectedDepartment, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let allTickets = [];
      
      // Admin and Director see all tickets. The cap here is a global,
      // system-wide count (not per-department/store), so it must stay well
      // above total ticket volume — a cap of 1000 silently dropped older
      // tickets once the system passed ~1000 total, hiding them from every
      // report below regardless of department/store filtering.
      if (user.user_type === 'admin' || user.user_type === 'director') {
        allTickets = await base44.entities.Ticket.list('-created_date', 5000);
      }
      // Department Head sees their department tickets — handling_department_id
      // is the department currently responsible after routing/approval.
      else if (user.user_type === 'department_head' && user.department_id) {
        allTickets = await base44.entities.Ticket.filter({ handling_department_id: user.department_id }, '-created_date', 5000);
      }
      // Store Manager sees tickets from their assigned stores only
      else if (user.user_type === 'store_manager') {
        const all = await base44.entities.Ticket.list('-created_date', 5000);
        const stores = user.assigned_stores || [];
        allTickets = all.filter(t => t.store_name && stores.includes(t.store_name));
      }
      
      // Filter by date range
      const cutoffDate = subDays(new Date(), parseInt(dateRange));
      let filtered = allTickets.filter(t => new Date(t.created_date) >= cutoffDate);
      
      // Filter by department
      if (selectedDepartment !== 'all') {
        filtered = filtered.filter(t => t.handling_department_id === selectedDepartment);
      }
      
      return filtered;
    },
    enabled: !!user
  });

  const { historyByTicket, isLoading: movementLoading } = useTicketMovement(tickets);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!['admin', 'department_head', 'store_manager', 'director'].includes(user.user_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
        <Card className="max-w-md border-2 border-slate-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">Only Admins, Department Heads, Store Managers, and Directors can access reports.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate metrics
  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  // resolved_at is the field actually written when a ticket is marked
  // resolved/closed — updated_date bumps on any edit, so it overstates or
  // understates resolution time whenever a resolved ticket is touched again.
  const avgResolutionTime = tickets
    .filter(t => t.status === 'resolved' || t.status === 'closed')
    .reduce((acc, t) => {
      const hours = differenceInHours(new Date(t.resolved_at || t.updated_date), new Date(t.created_date));
      return acc + hours;
    }, 0) / (resolvedTickets || 1);

  const respondedTickets = tickets.filter(t => t.first_response_at);
  const avgResponseTime = respondedTickets.reduce((acc, t) => {
    return acc + differenceInHours(new Date(t.first_response_at), new Date(t.created_date));
  }, 0) / (respondedTickets.length || 1);

  const breachedTickets = tickets.filter(t => t.sla_response_breached || t.sla_resolution_breached).length;
  const slaBreachRate = totalTickets ? Math.round((breachedTickets / totalTickets) * 100) : 0;

  const handleExportExcel = () => {
    const deptName = selectedDepartment !== 'all' ? departments.find(d => d.id === selectedDepartment)?.name : 'All Departments';
    const periodLabel = dateRange === '1' ? 'Today' : `Last ${dateRange} Days`;
    const sheets = [
      {
        name: 'Summary',
        title: `Reports & Analytics — ${deptName} · ${periodLabel}`,
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Tickets', totalTickets],
          ['Resolved', resolvedTickets],
          ['Resolution Rate', `${totalTickets ? Math.round((resolvedTickets / totalTickets) * 100) : 0}%`],
          ['Avg Response Time', formatDurationHours(avgResponseTime)],
          ['Avg Resolution Time', formatDurationHours(avgResolutionTime)],
          ['SLA Breach Rate', `${slaBreachRate}%`],
          ['Open Tickets', tickets.filter(t => t.status === 'open').length],
        ],
      },
      {
        name: 'Tickets',
        headers: ['Ticket ID', 'Title', 'Department', 'Category', 'Status', 'Priority', 'Assigned To', 'Submitter', 'Store', 'Created Date', 'Resolved Date', 'Resolution Hours'],
        rows: tickets.map(t => [
          t.id,
          t.title,
          t.department_name,
          t.category_name || '',
          t.status,
          t.priority,
          t.assigned_to || 'Unassigned',
          t.submitter_name || t.submitter_email,
          t.store_name || '',
          format(new Date(t.created_date), 'yyyy-MM-dd HH:mm'),
          (t.status === 'resolved' || t.status === 'closed') ? format(new Date(t.resolved_at || t.updated_date), 'yyyy-MM-dd HH:mm') : '',
          (t.status === 'resolved' || t.status === 'closed') ? Math.round(differenceInHours(new Date(t.resolved_at || t.updated_date), new Date(t.created_date))) : '',
        ]),
      },
      {
        name: 'By Department',
        headers: ['Department', 'Total', 'Resolved', 'Open', 'Resolution Rate'],
        rows: Object.values(tickets.reduce((acc, t) => {
          const name = t.department_name || 'Unknown';
          if (!acc[name]) acc[name] = { name, total: 0, resolved: 0 };
          acc[name].total++;
          if (t.status === 'resolved' || t.status === 'closed') acc[name].resolved++;
          return acc;
        }, {})).map(d => [d.name, d.total, d.resolved, d.total - d.resolved, `${d.total ? Math.round((d.resolved / d.total) * 100) : 0}%`]),
      },
      {
        name: 'By Status',
        headers: ['Status', 'Count'],
        rows: Object.entries(tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {})).map(([s, c]) => [s.replace(/_/g, ' '), c]),
      },
      {
        name: 'By Priority',
        headers: ['Priority', 'Count'],
        rows: Object.entries(tickets.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {})).map(([p, c]) => [p, c]),
      },
      {
        name: 'No Response (1wk)',
        headers: ['Ticket ID', 'Title', 'Department', 'Priority', 'Store', 'Created Date', 'Days Waiting'],
        rows: getNoResponseTickets(tickets, 7).map(t => [
          t.id, t.title, t.department_name || '', t.priority, t.store_name || '',
          format(new Date(t.created_date), 'yyyy-MM-dd'),
          Math.floor((Date.now() - new Date(t.created_date).getTime()) / 86400000),
        ]),
      },
      {
        name: 'No Response (2wk)',
        headers: ['Ticket ID', 'Title', 'Department', 'Priority', 'Store', 'Created Date', 'Days Waiting'],
        rows: getNoResponseTickets(tickets, 14).map(t => [
          t.id, t.title, t.department_name || '', t.priority, t.store_name || '',
          format(new Date(t.created_date), 'yyyy-MM-dd'),
          Math.floor((Date.now() - new Date(t.created_date).getTime()) / 86400000),
        ]),
      },
      {
        name: 'Movement (Top 10)',
        headers: ['Type', 'Ticket ID', 'Title', 'Status', 'Status Changes / Days Stuck'],
        rows: (() => {
          const { mostMoving, nonMoving } = computeTicketMovement(tickets, historyByTicket);
          return [
            ...mostMoving.map(({ ticket, history }) => ['Most Moving', ticket.id, ticket.title, ticket.status, history.length]),
            ...nonMoving.map(({ ticket }) => ['Non-Moving', ticket.id, ticket.title, ticket.status, Math.floor((Date.now() - new Date(ticket.created_date).getTime()) / 86400000)]),
          ];
        })(),
      },
    ];
    exportSheetsToExcel('Reports_Analytics', sheets);
  };

  return (
    <div className="app-page-shell">
      <div className="app-page">
        {/* Header */}
        <div className="app-page-header">
          <div>
          <p className="app-page-eyebrow">Performance reporting</p>
          <h1 className="app-page-heading">Reports & analytics</h1>
          <p className="app-page-description">
            {user.user_type === 'admin'
              ? 'System-wide performance metrics and insights'
              : user.user_type === 'store_manager'
              ? `Performance metrics for ${(user.assigned_stores || []).join(', ') || 'your stores'}`
              : `Performance metrics for ${user.department_name}`}
          </p></div>
        </div>

        {/* Filters */}
        <Card className="mb-8 border-2 border-slate-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-semibold text-slate-900 mb-2 block">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="border-slate-300 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="14">Last 14 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="60">Last 60 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="180">Last 180 Days</SelectItem>
                    <SelectItem value="365">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {user.user_type === 'admin' && (
                <div className="flex-1">
                  <label className="text-sm font-semibold text-slate-900 mb-2 block">Department</label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="border-slate-300 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <ExportButton 
                tickets={tickets} 
                dateRange={dateRange}
                departmentName={selectedDepartment !== 'all' ? departments.find(d => d.id === selectedDepartment)?.name : null}
              />
              <ExcelExportButton onClick={handleExportExcel} disabled={tickets.length === 0} />
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <StatsCard
                title="Total Tickets"
                value={totalTickets}
                icon={BarChart3}
                color="bg-[#1fd655]"
                subtitle={dateRange === '1' ? 'Today' : `Last ${dateRange} days`}
              />
              <StatsCard
                title="Resolved"
                value={resolvedTickets}
                icon={TrendingUp}
                color="bg-emerald-500"
                subtitle={`${totalTickets ? Math.round((resolvedTickets/totalTickets)*100) : 0}% resolution rate`}
              />
              <StatsCard
                title="Avg Resolution"
                value={formatDurationHours(avgResolutionTime)}
                icon={Clock}
                color="bg-blue-500"
                subtitle="Created to resolved"
              />
              <StatsCard
                title="Open Tickets"
                value={tickets.filter(t => t.status === 'open').length}
                icon={Users}
                color="bg-amber-500"
                subtitle="Awaiting response"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-6 mb-10">
              <StatsCard
                title="Avg Response Time"
                value={formatDurationHours(avgResponseTime)}
                icon={Timer}
                color="bg-indigo-500"
                subtitle="Created to first staff reply"
              />
              <StatsCard
                title="SLA Breach Rate"
                value={`${slaBreachRate}%`}
                icon={ShieldAlert}
                color="bg-red-500"
                subtitle={`${breachedTickets} of ${totalTickets} tickets`}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <TicketsByStatus tickets={tickets} />
              <TicketsByPriority tickets={tickets} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <TicketsByDepartment tickets={tickets} />
              <UserWorkloadChart tickets={tickets} />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              <ResolutionTimeByCategory tickets={tickets} />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              <ResolutionTimeChart tickets={tickets} dateRange={parseInt(dateRange)} />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              <NoResponseReport tickets={tickets} departments={departments} stores={stores} />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              <SpeedInsights tickets={tickets} />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              <TicketMovementReport tickets={tickets} historyByTicket={historyByTicket} isLoading={movementLoading} />
            </div>

            <FeedbackInsights
              departmentId={selectedDepartment !== 'all' ? selectedDepartment : user?.department_id}
              dateRangeDays={dateRange}
            />
          </>
        )}
      </div>
    </div>
  );
}
