import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import moment from 'moment';

function AnswerBadge({ value }) {
  if (!value) return <span className="text-slate-300 text-xs">—</span>;
  const cls = value === 'YES' ? 'bg-green-100 text-green-700' : value === 'NO' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{value === 'NA' ? 'N/A' : value}</span>;
}

export default function NoAnswerTracker({ allowedStores = null }) {
  const [selectedStore, setSelectedStore] = useState('');
  const [dateFrom, setDateFrom] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['audit-submissions-no-tracker'],
    queryFn: () => base44.entities.AuditSubmission.list('-created_date', 3000),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['audit-templates-no-tracker'],
    queryFn: () => base44.entities.AuditTemplate.list('-created_date', 500),
  });

  // Scope to allowed stores when provided (store managers); otherwise show all stores
  const scopedSubmissions = useMemo(() => {
    if (!allowedStores) return submissions;
    return submissions.filter(s => allowedStores.some(name => s.brand?.includes(name)));
  }, [submissions, allowedStores]);

  const stores = useMemo(() => Array.from(new Set(scopedSubmissions.map(s => s.brand).filter(Boolean))).sort(), [scopedSubmissions]);

  useEffect(() => {
    if (!selectedStore && stores.length > 0) setSelectedStore(stores[0]);
  }, [stores, selectedStore]);

  const itemLabelMap = useMemo(() => {
    const map = {};
    templates.forEach(t => {
      t.sections?.forEach(sec => {
        sec.items?.forEach(item => {
          map[`${t.id}::${item.id}`] = { templateTitle: t.title, label: item.label };
        });
      });
    });
    return map;
  }, [templates]);

  const filtered = useMemo(() => {
    let subs = scopedSubmissions.filter(s => s.brand === selectedStore);
    if (dateFrom) subs = subs.filter(s => new Date(s.submission_date || s.created_date) >= new Date(`${dateFrom}T00:00:00+08:00`));
    if (dateTo) subs = subs.filter(s => new Date(s.submission_date || s.created_date) <= new Date(`${dateTo}T23:59:59+08:00`));
    return subs;
  }, [scopedSubmissions, selectedStore, dateFrom, dateTo]);

  const noItemColumns = useMemo(() => {
    const keys = new Set();
    filtered.forEach(sub => {
      Object.entries(sub.answers || {}).forEach(([itemId, val]) => {
        if (val === 'NO') keys.add(`${sub.template_id}::${itemId}`);
      });
    });
    return Array.from(keys)
      .map(key => ({ key, ...(itemLabelMap[key] || { templateTitle: 'Unknown', label: key.split('::')[1] }) }))
      .sort((a, b) => a.templateTitle.localeCompare(b.templateTitle) || a.label.localeCompare(b.label));
  }, [filtered, itemLabelMap]);

  const dayRows = useMemo(() => {
    const dayMap = new Map();
    filtered.forEach(sub => {
      const day = moment(sub.submission_date || sub.created_date).utcOffset(8).format('YYYY-MM-DD');
      if (!dayMap.has(day)) dayMap.set(day, {});
      dayMap.get(day)[sub.template_id] = sub;
    });
    return Array.from(dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, subsByTemplate]) => ({ day, subsByTemplate }));
  }, [filtered]);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5">
        <p className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> NO Answer Tracker</p>
        <p className="text-xs text-slate-500">Monitor checklist items marked NO per day, per store, to see if they get resolved to YES</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-64 h-9">
              <SelectValue placeholder="Select store..." />
            </SelectTrigger>
            <SelectContent>
              {stores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
            <span className="text-slate-400 text-sm">–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : !selectedStore ? (
          <p className="text-center text-slate-400 py-12 text-sm">Select a store to view its NO answer history.</p>
        ) : noItemColumns.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">No NO answers found for this store in the selected date range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide sticky left-0 bg-slate-50">Date</th>
                  {noItemColumns.map(c => (
                    <th key={c.key} className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
                      {c.templateTitle}<br /><span className="normal-case font-medium text-slate-500">{c.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayRows.map(row => (
                  <tr key={row.day} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white">
                      {moment(row.day).format('MMM D, YYYY')}
                    </td>
                    {noItemColumns.map(c => {
                      const sub = row.subsByTemplate[c.key.split('::')[0]];
                      const val = sub?.answers?.[c.key.split('::')[1]];
                      return (
                        <td key={c.key} className="text-center px-3 py-3"><AnswerBadge value={val} /></td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}