import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export default function ReportFilters({ filters, onChange, categories, staff, showDepartments, departments }) {
  const update = (key, val) => onChange({ ...filters, [key]: val });

  const clearFilters = () => onChange({
    period: 'monthly',
    dateRange: '1',
    department: 'all',
    category: 'all',
    staff: 'all',
    customFrom: '',
    customTo: '',
  });

  const hasActiveFilters =
    filters.period !== 'monthly' ||
    filters.dateRange !== '30' ||
    filters.department !== 'all' ||
    filters.category !== 'all' ||
    filters.staff !== 'all';

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-[#1fd655]" />
          <span className="font-semibold text-slate-900 text-sm">Report Filters</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 px-2 text-xs text-slate-500 gap-1">
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Period */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Report Period</Label>
            <Select value={filters.period} onValueChange={v => update('period', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range (shown when not custom) */}
          {filters.period !== 'custom' && (
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date Range</Label>
              <Select value={filters.dateRange} onValueChange={v => update('dateRange', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filters.period === 'weekly' && (
                    <>
                      <SelectItem value="7">Last 1 Week</SelectItem>
                      <SelectItem value="14">Last 2 Weeks</SelectItem>
                      <SelectItem value="28">Last 4 Weeks</SelectItem>
                    </>
                  )}
                  {filters.period === 'monthly' && (
                    <>
                      <SelectItem value="1">Today</SelectItem>
                      <SelectItem value="30">Last 1 Month</SelectItem>
                      <SelectItem value="60">Last 2 Months</SelectItem>
                      <SelectItem value="90">Last 3 Months</SelectItem>
                      <SelectItem value="180">Last 6 Months</SelectItem>
                    </>
                  )}
                  {filters.period === 'yearly' && (
                    <>
                      <SelectItem value="365">Last 1 Year</SelectItem>
                      <SelectItem value="730">Last 2 Years</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Date From */}
          {filters.period === 'custom' && (
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">From</Label>
              <Input type="date" value={filters.customFrom} onChange={e => update('customFrom', e.target.value)} className="h-9 text-sm" />
            </div>
          )}
          {filters.period === 'custom' && (
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">To</Label>
              <Input type="date" value={filters.customTo} onChange={e => update('customTo', e.target.value)} className="h-9 text-sm" />
            </div>
          )}

          {/* Department (admin only) */}
          {showDepartments && (
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Department</Label>
              <Select value={filters.department} onValueChange={v => update('department', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {(departments || []).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Category</Label>
            <Select value={filters.category} onValueChange={v => update('category', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(categories || []).map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Staff Member</Label>
            <Select value={filters.staff} onValueChange={v => update('staff', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {(staff || []).map(s => (
                  <SelectItem key={s.email} value={s.email}>{s.full_name || s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}