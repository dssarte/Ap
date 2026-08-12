import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import moment from 'moment';
import { auditBusinessDayKey } from '@/lib/dateUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';

const PIE_COLORS = ['#ef4444', '#f59e0b', '#a855f7', '#3b82f6', '#10b981', '#ec4899', '#64748b', '#0ea5e9', '#eab308', '#8b5cf6'];

function AnswerBadge({ value }) {
  if (!value) return <span className="text-slate-300 text-xs">—</span>;
  const cls = value === 'YES' ? 'bg-green-100 text-green-700' : value === 'NO' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{value === 'NA' ? 'N/A' : value}</span>;
}

export default function NoAnswerTracker({ allowedStores = null }) {
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [selectedStore, setSelectedStore] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['audit-submissions-no-tracker', dateFrom, dateTo, allowedStores?.join('|') || 'all'],
    queryFn: () => base44.audit.listSubmissions({
      dateFrom,
      dateTo,
      stores: allowedStores,
      maxRows: 10000,
    }),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['audit-templates-no-tracker'],
    queryFn: () => base44.entities.AuditTemplate.list('-created_date', 500),
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['audit-brands-no-tracker'],
    queryFn: () => base44.entities.Brand.list('-created_date', 500),
  });

  // Scope to allowed stores when provided (store managers); otherwise show all stores
  const scopedSubmissions = useMemo(() => {
    if (!allowedStores) return submissions;
    return submissions.filter(s => allowedStores.some(name => s.brand?.includes(name)));
  }, [submissions, allowedStores]);

  const selectedBrand = useMemo(() => brands.find(b => b.id === selectedBrandId) || null, [brands, selectedBrandId]);

  // Stores available for the selected brand (or all stores when brand is "all")
  const stores = useMemo(() => {
    const subs = selectedBrand
      ? scopedSubmissions.filter(s => s.brand?.startsWith(selectedBrand.brand_name))
      : scopedSubmissions;
    return Array.from(new Set(subs.map(s => s.brand).filter(Boolean))).sort();
  }, [scopedSubmissions, selectedBrand]);

  // Reset the store filter whenever the brand changes so it can't point at a store outside the new brand
  useEffect(() => {
    setSelectedStore('all');
  }, [selectedBrandId]);

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
    let subs = scopedSubmissions;
    if (selectedBrand) subs = subs.filter(s => s.brand?.startsWith(selectedBrand.brand_name));
    if (selectedStore !== 'all') subs = subs.filter(s => s.brand === selectedStore);
    if (dateFrom) subs = subs.filter(s => auditBusinessDayKey(s) >= dateFrom);
    if (dateTo) subs = subs.filter(s => auditBusinessDayKey(s) <= dateTo);
    return subs;
  }, [scopedSubmissions, selectedBrand, selectedStore, dateFrom, dateTo]);

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

  const noAnswerPieData = useMemo(() => {
    const counts = new Map();
    filtered.forEach(sub => {
      Object.entries(sub.answers || {}).forEach(([itemId, val]) => {
        if (val !== 'NO') return;
        const key = `${sub.template_id}::${itemId}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([key, count]) => {
        const info = itemLabelMap[key] || { templateTitle: 'Unknown', label: key.split('::')[1] };
        return { name: `${info.templateTitle} – ${info.label}`, value: count };
      })
      .sort((a, b) => b.value - a.value);
  }, [filtered, itemLabelMap]);

  const noAnswerPieTop10 = useMemo(() => noAnswerPieData.slice(0, 10), [noAnswerPieData]);

  const showStoreColumn = selectedStore === 'all' && stores.length > 1;

  const dayRows = useMemo(() => {
    const rowMap = new Map();
    filtered.forEach(sub => {
      const day = auditBusinessDayKey(sub);
      const key = `${day}::${sub.brand}`;
      if (!rowMap.has(key)) rowMap.set(key, { day, store: sub.brand, subsByTemplate: {} });
      rowMap.get(key).subsByTemplate[sub.template_id] = sub;
    });
    return Array.from(rowMap.values())
      .sort((a, b) => b.day.localeCompare(a.day) || a.store.localeCompare(b.store));
  }, [filtered]);

  const handleExport = () => {
    const summarySheet = {
      name: 'Summary',
      title: `NO Answer Summary (${dateFrom} to ${dateTo})`,
      headers: ['Checklist', 'Item', 'NO Count'],
      rows: noAnswerPieData.map(d => {
        const [checklist, item] = d.name.split(' – ');
        return [checklist, item ?? '', d.value];
      }),
    };

    const detailHeaders = ['Date', ...(showStoreColumn ? ['Store'] : []), ...noItemColumns.map(c => `${c.templateTitle} - ${c.label}`)];
    const detailRows = dayRows.map(row => {
      const cells = [moment(row.day).format('YYYY-MM-DD')];
      if (showStoreColumn) cells.push(row.store);
      noItemColumns.forEach(c => {
        const [templateId, itemId] = c.key.split('::');
        const val = row.subsByTemplate[templateId]?.answers?.[itemId];
        cells.push(val === 'NA' ? 'N/A' : (val || ''));
      });
      return cells;
    });
    const detailSheet = {
      name: 'Detail',
      title: `NO Answer Detail (${dateFrom} to ${dateTo})`,
      headers: detailHeaders,
      rows: detailRows,
    };

    exportSheetsToExcel('NO_Answer_Report', [summarySheet, detailSheet]);
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5">
        <p className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> NO Answer Tracker</p>
        <p className="text-xs text-slate-500">Monitor checklist items marked NO per day, per store, to see if they get resolved to YES</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Select brand..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-64 h-9">
              <SelectValue placeholder="Select store..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
            <span className="hidden text-sm text-slate-400 sm:inline">–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
          </div>
          <ExcelExportButton onClick={handleExport} disabled={noItemColumns.length === 0} label="Export Report" className="sm:ml-auto" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : noItemColumns.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">No NO answers found for the selected filters and date range.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                Top 10 NO Answers by Checklist Item
                {noAnswerPieData.length > 10 && (
                  <span className="ml-1 font-normal text-slate-400 normal-case">(of {noAnswerPieData.length} items with NO answers — full breakdown in the exported report)</span>
                )}
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={noAnswerPieTop10}
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    dataKey="value"
                  >
                    {noAnswerPieTop10.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} NO`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 max-h-40 overflow-y-auto flex flex-wrap gap-x-4 gap-y-1.5 px-2">
                {noAnswerPieTop10.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide sticky left-0 bg-slate-50">Date</th>
                  {showStoreColumn && (
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">Store</th>
                  )}
                  {noItemColumns.map(c => (
                    <th key={c.key} className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
                      {c.templateTitle}<br /><span className="normal-case font-medium text-slate-500">{c.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayRows.map(row => (
                  <tr key={`${row.day}::${row.store}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white">
                      {moment(row.day).format('MMM D, YYYY')}
                    </td>
                    {showStoreColumn && (
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.store}</td>
                    )}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
