import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, TrendingUp, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { subDays, differenceInHours } from 'date-fns';
import StatsCard from "@/components/dashboard/StatsCard";
import TicketsByDepartment from "@/components/reports/TicketsByDepartment";
import VolumeOverTimeChart from "./analytics/VolumeOverTimeChart";
import DeptResolutionChart from "./analytics/DeptResolutionChart";
import SLAComplianceChart from "./analytics/SLAComplianceChart";
import SLAComplianceOverTime from "./analytics/SLAComplianceOverTime";

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState('30');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    base44.entities.Department.list().then(setDepartments);
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-analytics', dateRange, selectedDepartment],
    queryFn: async () => {
      const all = await base44.entities.Ticket.list('-created_date', 2000);
      const cutoff = subDays(new Date(), parseInt(dateRange));
      let filtered = all.filter(t => new Date(t.created_date) >= cutoff);
      if (selectedDepartment !== 'all') {
        filtered = filtered.filter(t => t.department_id === selectedDepartment);
      }
      return filtered;
    },
  });

  // KPIs
  const total = tickets.length;
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  const avgRes = resolved.length > 0
    ? Math.round(resolved.filter(t => t.resolved_at).reduce((s, t) => s + differenceInHours(new Date(t.resolved_at), new Date(t.created_date)), 0) / resolved.filter(t => t.resolved_at).length)
    : 0;
  const breached = tickets.filter(t => t.sla_response_breached || t.sla_resolution_breached).length;
  const slaCompliance = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Date Range</label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-44 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="14">Last 14 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="60">Last 60 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="180">Last 180 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Department</label>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-52 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard title="Total Tickets" value={total} icon={BarChart3} color="bg-[#1fd655]" subtitle={`Last ${dateRange} days`} />
            <StatsCard title="Resolution Rate" value={`${total ? Math.round((resolved.length / total) * 100) : 0}%`} icon={TrendingUp} color="bg-blue-500" subtitle={`${resolved.length} resolved`} />
            <StatsCard title="Avg Resolution" value={`${avgRes}h`} icon={Clock} color="bg-amber-500" subtitle="Per resolved ticket" />
            <StatsCard title="SLA Compliance" value={`${slaCompliance}%`} icon={slaCompliance >= 90 ? ShieldCheck : AlertTriangle} color={slaCompliance >= 90 ? 'bg-emerald-500' : 'bg-red-500'} subtitle={`${breached} breach${breached !== 1 ? 'es' : ''}`} />
          </div>

          {/* Volume Over Time (full width) */}
          <VolumeOverTimeChart tickets={tickets} dateRange={dateRange} />

          {/* Department Volume + Avg Resolution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TicketsByDepartment tickets={tickets} />
            <DeptResolutionChart tickets={tickets} />
          </div>

          {/* SLA charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SLAComplianceChart tickets={tickets} />
            <SLAComplianceOverTime tickets={tickets} dateRange={dateRange} />
          </div>
        </>
      )}
    </div>
  );
}