import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarCheck, Settings2, ChevronDown, ChevronUp, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import moment from 'moment';
import { auditBusinessDayKey } from '@/lib/dateUtils';
import { templateAppliesToStore } from '@/lib/auditTemplateMatch';

export default function ChecklistCompletionCard({
  templates,
  submissions,
  dateFrom,
  dateTo,
  isAdmin = false,
  selectedIds = [],
  onToggle,
  onSelectAll,
  onClearAll,
  saving = false,
  // Preferred: full store records ({ id, store_name, ... }) — needed to
  // track completion per store. `storeNames` (plain strings) is accepted
  // as a fallback for older callers that don't have full records handy.
  stores = [],
  storeNames = [],
}) {
  const [showManager, setShowManager] = useState(false);
  const [breakdownDay, setBreakdownDay] = useState('');

  const storeList = useMemo(() => {
    if (stores?.length) return stores;
    return (storeNames || []).map(name => ({ id: name, store_name: name }));
  }, [stores, storeNames]);

  const activeTemplates = useMemo(
    () => templates.filter(t => selectedIds.includes(t.id)),
    [templates, selectedIds]
  );

  // What's actually required, per store — a checklist only counts against a
  // store if it's assigned to that store. One store finishing a checklist
  // doesn't count it as done for every other store that also requires it.
  const storeRequirements = useMemo(() => {
    return storeList
      .map(store => ({ store, templates: activeTemplates.filter(t => templateAppliesToStore(t, store)) }))
      .filter(r => r.templates.length > 0);
  }, [storeList, activeTemplates]);

  const totalRequiredPerDay = useMemo(
    () => storeRequirements.reduce((sum, r) => sum + r.templates.length, 0),
    [storeRequirements]
  );

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
      const daySubs = submissions.filter(s => auditBusinessDayKey(s) === day);
      let completed = 0;
      const perStore = storeRequirements.map(({ store, templates: required }) => {
        const storeDaySubs = daySubs.filter(s => s.brand?.includes(store.store_name));
        const doneIds = new Set(storeDaySubs.map(s => s.template_id));
        const missing = required.filter(t => !doneIds.has(t.id));
        const doneCount = required.length - missing.length;
        completed += doneCount;
        return { store, required: required.length, completed: doneCount, missing };
      });
      const rate = totalRequiredPerDay > 0 ? Math.round((completed / totalRequiredPerDay) * 100) : 0;
      return { day, completed, total: totalRequiredPerDay, rate, perStore };
    });
  }, [days, submissions, storeRequirements, totalRequiredPerDay]);

  const overallRate = useMemo(() => {
    if (dailyStats.length === 0 || totalRequiredPerDay === 0) return 0;
    const totalCompleted = dailyStats.reduce((s, d) => s + d.completed, 0);
    const totalRequired = totalRequiredPerDay * dailyStats.length;
    return totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;
  }, [dailyStats, totalRequiredPerDay]);

  // Default the store-breakdown view to the most recent day in range, and
  // keep it valid whenever the date range changes.
  useEffect(() => {
    if (days.length && !days.includes(breakdownDay)) setBreakdownDay(days[days.length - 1]);
  }, [days, breakdownDay]);

  const breakdownStats = dailyStats.find(d => d.day === breakdownDay) || dailyStats[dailyStats.length - 1];

  // Grouped by brand so a store manager with many stores gets a collapsed
  // accordion per brand instead of one long flat list.
  const breakdownGroups = useMemo(() => {
    const rows = breakdownStats?.perStore || [];
    const groups = new Map();
    rows.forEach(row => {
      const brandName = row.store.brand_name || 'Stores';
      if (!groups.has(brandName)) groups.set(brandName, []);
      groups.get(brandName).push(row);
    });
    return Array.from(groups.entries())
      .map(([brandName, rows]) => ({
        brandName,
        rows,
        completed: rows.reduce((s, r) => s + r.completed, 0),
        required: rows.reduce((s, r) => s + r.required, 0),
      }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName));
  }, [breakdownStats]);

  if (templates.length === 0) return null;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold text-slate-800 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-[#1fd655]" /> Checklist Completion Rate
        </p>
        <div className="flex items-center gap-2 flex-wrap">
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
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overall Completion</p>
          <p className={`text-3xl font-extrabold ${overallRate >= 75 ? 'text-green-600' : 'text-red-600'}`}>{overallRate}%</p>
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

        {/* Per-store breakdown — which stores haven't completed their
            required checklists, and exactly which ones they're missing. */}
        {storeRequirements.length > 0 && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-slate-400" /> Store Breakdown
              </p>
              {days.length > 1 && (
                <Select value={breakdownDay} onValueChange={setBreakdownDay}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map(d => (
                      <SelectItem key={d} value={d}>{moment(d).format('MMM D, YYYY')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {breakdownGroups.length === 0 ? (
              <p className="text-center px-3 py-6 text-sm text-slate-400">No stores to show.</p>
            ) : (
              <Accordion type="multiple" className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {breakdownGroups.map(group => {
                  return (
                    <AccordionItem key={group.brandName} value={group.brandName} className="border-0">
                      <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-800">{group.brandName}</span>
                          <span className="text-xs text-slate-400">{group.rows.length} store{group.rows.length !== 1 ? 's' : ''}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-0 pt-0 pb-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wide">Store</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wide">Missing</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rows.map((row, i) => (
                                <tr key={row.store.id || row.store.store_name} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                                  <td className="px-3 py-2 font-medium text-slate-800">{row.store.store_name}</td>
                                  <td className="px-3 py-2 text-xs text-slate-500">
                                    {row.missing.length > 0
                                      ? row.missing.map(t => t.title).join(', ')
                                      : <span className="text-green-600 font-medium">All done</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
