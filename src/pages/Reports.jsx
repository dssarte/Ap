import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, TrendingUp, Clock, Users } from "lucide-react";
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

export default function Reports() {
  const [user, setUser] = useState(null);
  const [dateRange, setDateRange] = useState('1'); // days (default: today only)
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    loadUser();
    loadDepartments();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const loadDepartments = async () => {
    const depts = await base44.entities.Department.list();
    setDepartments(depts);
  };

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['reports-tickets', dateRange, selectedDepartment, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let allTickets = [];
      
      // Admin sees all tickets
      if (user.user_type === 'admin') {
        allTickets = await base44.entities.Ticket.list('-created_date', 1000);
      } 
      // Department Head sees their department tickets
      else if (user.user_type === 'department_head' && user.department_id) {
        allTickets = await base44.entities.Ticket.filter({ department_id: user.department_id }, '-created_date', 1000);
      }
      // Store Manager sees tickets from their assigned stores only
      else if (user.user_type === 'store_manager') {
        const all = await base44.entities.Ticket.list('-created_date', 1000);
        const stores = user.assigned_stores || [];
        allTickets = all.filter(t => t.store_name && stores.includes(t.store_name));
      }
      
      // Filter by date range
      const cutoffDate = subDays(new Date(), parseInt(dateRange));
      let filtered = allTickets.filter(t => new Date(t.created_date) >= cutoffDate);
      
      // Filter by department
      if (selectedDepartment !== 'all') {
        filtered = filtered.filter(t => t.department_id === selectedDepartment);
      }
      
      return filtered;
    },
    enabled: !!user
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (user.user_type !== 'admin' && user.user_type !== 'department_head' && user.user_type !== 'store_manager') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
        <Card className="max-w-md border-2 border-slate-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">Only Admins, Department Heads, and Store Managers can access reports.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate metrics
  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const avgResolutionTime = tickets
    .filter(t => t.status === 'resolved' || t.status === 'closed')
    .reduce((acc, t) => {
      const hours = differenceInHours(new Date(t.updated_date), new Date(t.created_date));
      return acc + hours;
    }, 0) / (resolvedTickets || 1);

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
          ['Avg Resolution Time', `${Math.round(avgResolutionTime)}h`],
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
          (t.status === 'resolved' || t.status === 'closed') ? format(new Date(t.updated_date), 'yyyy-MM-dd HH:mm') : '',
          (t.status === 'resolved' || t.status === 'closed') ? Math.round(differenceInHours(new Date(t.updated_date), new Date(t.created_date))) : '',
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
    ];
    exportSheetsToExcel('Reports_Analytics', sheets);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3 flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#1fd655] flex items-center justify-center shadow-lg">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            Reports & Analytics
          </h1>
          <p className="text-slate-600 text-lg">
            {user.user_type === 'admin'
              ? 'System-wide performance metrics and insights'
              : user.user_type === 'store_manager'
              ? `Performance metrics for ${(user.assigned_stores || []).join(', ') || 'your stores'}`
              : `Performance metrics for ${user.department_name}`}
          </p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
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
                value={`${Math.round(avgResolutionTime)}h`}
                icon={Clock} 
                color="bg-blue-500"
                subtitle="Average time"
              />
              <StatsCard 
                title="Open Tickets" 
                value={tickets.filter(t => t.status === 'open').length}
                icon={Users} 
                color="bg-amber-500"
                subtitle="Awaiting response"
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

            <div className="grid grid-cols-1 gap-6">
              <ResolutionTimeChart tickets={tickets} dateRange={parseInt(dateRange)} />
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