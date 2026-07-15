import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarCheck, Settings2, ChevronDown, ChevronUp, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from 'moment';

function dayKey(dateStr) {
  return moment(dateStr).utcOffset(8).format('YYYY-MM-DD');
}

export default function ChecklistCompletionCard({
  templates,
  submissions,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  isAdmin = false,
  selectedIds = [],
  onToggle,
  onSelectAll,
  onClearAll,
  saving = false,
  storeNames = [],
  selectedStore = 'all',
  onStoreChange,
}) {
  const [showManager, setShowManager] = useState(false);

  const activeTemplates = useMemo(
    () => templates.filter(t => selectedIds.includes(t.id)),
    [templates, selectedIds]
  );
  const totalTemplates = activeTemplates.length;

  const days = useMemo(() => {
    const result = [];
    let cur = moment(dateFrom, 'YYYY-MM-DD');
    const end = moment(dateTo, 'YYYY-MM-DD');
    if (!cur.isValid() || !end.isValid() || cur.isAfter(end)) return result;
    while (cur.isSameOrBefore(end)) {
      result.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
    return result;
  }, [dateFrom, dateTo]);

  const dailyStats = useMemo(() => {
    return days.map(day => {
      const daySubs = submissions.filter(s => dayKey(s.submission_date || s.created_date) === day);
      const completedIds = new Set(daySubs.map(s => s.template_id));
      const completed = activeTemplates.filter(t => completedIds.has(t.id)).length;
      const rate = totalTemplates > 0 ? Math.round((completed / totalTemplates) * 100) : 0;
      return { day, completed, total: totalTemplates, rate };
    });
  }, [days, submissions, activeTemplates, totalTemplates]);

  const overallRate = useMemo(() => {
    if (dailyStats.length === 0 || totalTemplates === 0) return 0;
    const totalCompleted = dailyStats.reduce((s, d) => s + d.completed, 0);
    const totalRequired = totalTemplates * dailyStats.length;
    return totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;
  }, [dailyStats, totalTemplates]);

  if (templates.length === 0) return null;

  const showStoreSelector = storeNames.length > 1 && onStoreChange;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold text-slate-800 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-[#1fd655]" /> Checklist Completion Rate
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {showStoreSelector && (
            <div className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <Select value={selectedStore} onValueChange={onStoreChange}>
                <SelectTrigger className="h-8 w-[140px] text-xs border-slate-300">
                  <SelectValue placeholder="Store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {storeNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <input
            type="date"
            value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
          />
          <span className="text-slate-400 text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => onDateToChange(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
          />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold border-slate-300"
              onClick={() => setShowManager(s => !s)}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />}
              Manage Checklists
              {showManager ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </CardHeader>

      {isAdmin && showManager && (
        <CardContent className="px-5 pt-0 pb-4">
          <div className="border border-slate-200 rounded-lg bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Select which checklists count toward completion ({selectedIds.length} of {templates.length} selected)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectAll} disabled={saving}>Select All</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll} disabled={saving}>Clear All</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
              {templates.map(t => (
                <label key={t.id} className="flex items-center gap-2.5 p-2 rounded-md bg-white border border-slate-200 hover:border-[#1fd655] cursor-pointer transition-colors">
                  <Checkbox
                    checked={selectedIds.includes(t.id)}
                    onCheckedChange={() => onToggle(t.id)}
                    disabled={saving}
                  />
                  <span className="text-sm text-slate-700 font-medium truncate">{t.title}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400">This selection applies to all store users' completion rate. QA audit templates are excluded by default.</p>
          </div>
        </CardContent>
      )}

      <CardContent className="px-5 pb-5 space-y-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overall Completion</p>
            <p className={`text-3xl font-extrabold ${overallRate >= 75 ? 'text-green-600' : 'text-red-600'}`}>{overallRate}%</p>
          </div>
          <p className="text-xs text-slate-400">{totalTemplates} checklist{totalTemplates !== 1 ? 's' : ''} required daily</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</th>
                <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wide">Completed</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wide">Rate</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.map((d, i) => (
                <tr key={d.day} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                  <td className="px-3 py-2 text-slate-700">{moment(d.day).format('MMM D, YYYY')}</td>
                  <td className="text-center px-3 py-2 text-slate-700">{d.completed} of {d.total}</td>
                  <td className={`text-right px-3 py-2 font-bold ${d.rate >= 75 ? 'text-green-600' : 'text-red-600'}`}>{d.rate}%</td>
                </tr>
              ))}
              {dailyStats.length === 0 && (
                <tr><td colSpan={3} className="text-center px-3 py-6 text-slate-400">Select a valid date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}