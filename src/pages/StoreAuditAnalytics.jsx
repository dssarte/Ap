import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Minus, ClipboardCheck, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import moment from 'moment';
import { useEffect } from 'react';
import { formatPHDateTime } from '@/lib/dateUtils';
import ChecklistCompletionCard from '@/components/audit/ChecklistCompletionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';

const PASS_THRESHOLD = 75;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

function ScoreBadge({ score }) {
  if (score == null) return null;
  const cls = score >= 80 ? 'bg-green-100 text-green-700' : score >= PASS_THRESHOLD ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{score.toFixed(1)}%</span>;
}

function dayKey(dateStr) {
  return moment(dateStr).utcOffset(8).format('YYYY-MM-DD');
}

export default function StoreAuditAnalytics() {
  const [user, setUser] = useState(null);
  const [selectedStore, setSelectedStore] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const today = moment().utcOffset(8).format('YYYY-MM-DD');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const storeNames = useMemo(() => {
    if (!user) return [];
    if (user.store_name) return [user.store_name];
    return user.assigned_stores || [];
  }, [user]);

  const isStoreManager = user?.user_type === 'store_manager';
  const historyFrom = useMemo(() => moment().utcOffset(8).subtract(89, 'days').format('YYYY-MM-DD'), []);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['store-audit-analytics', storeNames.join(','), historyFrom],
    queryFn: () => base44.audit.listSubmissions({
      dateFrom: historyFrom,
      dateTo: today,
      stores: storeNames,
      maxRows: 10000,
    }),
    enabled: storeNames.length > 0,
  });

  // Only submissions from this user's store(s), filtered by the selected store when applicable
  const storeSubmissions = useMemo(() => {
    if (storeNames.length === 0) return [];
    const activeStores = selectedStore === 'all' ? storeNames : [selectedStore];
    return submissions.filter(s => s.brand && activeStores.some(name => s.brand.includes(name)) && s.score != null);
  }, [submissions, storeNames, selectedStore]);

  // All active templates available for checklist completion tracking
  const { data: allTemplates = [] } = useQuery({
    queryKey: ['audit-templates-active-analytics'],
    queryFn: () => base44.entities.AuditTemplate.filter({ is_active: true }, '-created_date', 100),
    enabled: storeNames.length > 0,
  });

  // Global checklist completion config (admin-controlled, shared across all store users)
  const { data: configRecords = [] } = useQuery({
    queryKey: ['checklist-completion-config'],
    queryFn: () => base44.entities.ChecklistConfig.filter({ config_key: 'default' }, '-updated_date', 10),
  });
  const configRecord = configRecords[0];

  // Exclude QA audit templates (unrestricted) — only store-restricted checklists count toward completion
  const completionTemplates = useMemo(() => {
    return allTemplates.filter(t => (t.store_restrictions?.length > 0 || t.store_name));
  }, [allTemplates]);

  // Determine selected IDs: admin config if set, otherwise default to all store-restricted templates
  const isAdmin = user?.user_type === 'admin';
  const selectedIds = useMemo(() => {
    if (configRecord?.selected_template_ids) return configRecord.selected_template_ids;
    return completionTemplates.map(t => t.id);
  }, [configRecord, completionTemplates]);

  const [saving, setSaving] = useState(false);

  const persistConfig = async (ids) => {
    setSaving(true);
    try {
      if (configRecord?.id) {
        await base44.entities.ChecklistConfig.update(configRecord.id, { selected_template_ids: ids });
      } else {
        await base44.entities.ChecklistConfig.create({ config_key: 'default', selected_template_ids: ids });
      }
      await queryClientInstance.invalidateQueries({ queryKey: ['checklist-completion-config'] });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    persistConfig(next);
  };
  const handleSelectAll = () => persistConfig(completionTemplates.map(t => t.id));
  const handleClearAll = () => persistConfig([]);

  useEffect(() => { setPage(1); }, [storeSubmissions.length, pageSize, selectedStore, auditDateFrom, auditDateTo]);

  // Recent Audits filtered by the audit date range (empty = no restriction)
  const recentAudits = useMemo(() => {
    return storeSubmissions.filter(s => {
      const k = dayKey(s.submission_date || s.created_date);
      if (auditDateFrom && k < auditDateFrom) return false;
      if (auditDateTo && k > auditDateTo) return false;
      return true;
    });
  }, [storeSubmissions, auditDateFrom, auditDateTo]);

  const handleExportExcel = () => {
    const sheets = [
      {
        name: 'Summary',
        title: `My Store Analytics — ${selectedStore === 'all' ? storeNames.join(', ') : selectedStore}`,
        headers: ['Metric', 'Value'],
        rows: stats ? [
          ['Overall Average', `${stats.avg.toFixed(1)}%`],
          ['Total Audits', stats.total],
          ['Passing', stats.passing],
          ['Failing', stats.failing],
        ] : [],
      },
      {
        name: 'Score by Template',
        headers: ['Template', 'Average Score', 'Audits', 'Status'],
        rows: templateScores.map(t => [t.title, `${t.avg}%`, t.count, t.isPassing ? 'PASS' : 'FAIL']),
      },
      {
        name: 'Recent Audits',
        headers: ['Template', 'Store', 'Score', 'YES', 'NO', 'N/A', 'Status', 'Date'],
        rows: recentAudits.map(s => [
          s.template_title, s.brand || '—', `${s.score?.toFixed(1) ?? ''}%`,
          s.yes_count, s.no_count, s.na_count,
          s.score >= PASS_THRESHOLD ? 'PASS' : 'FAIL',
          formatPHDateTime(s.submission_date || s.created_date),
        ]),
      },
    ];
    exportSheetsToExcel('My_Store_Analytics', sheets);
  };

  const totalPages = Math.max(1, Math.ceil(recentAudits.length / pageSize));
  const pagedSubmissions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return recentAudits.slice(start, start + pageSize);
  }, [recentAudits, page, pageSize]);

  // KPI stats
  const stats = useMemo(() => {
    if (!storeSubmissions.length) return null;
    const avg = storeSubmissions.reduce((s, x) => s + x.score, 0) / storeSubmissions.length;
    const passing = storeSubmissions.filter(s => s.score >= PASS_THRESHOLD).length;
    const latest = storeSubmissions[0];
    const prev = storeSubmissions[1];
    const trend = prev ? latest.score - prev.score : 0;
    return { avg, passing, failing: storeSubmissions.length - passing, total: storeSubmissions.length, latest, trend };
  }, [storeSubmissions]);

  // Submissions within the Checklist Completion Rate date range
  const rangeSubmissions = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    return storeSubmissions.filter(s => {
      const k = dayKey(s.submission_date || s.created_date);
      return k >= dateFrom && k <= dateTo;
    });
  }, [storeSubmissions, dateFrom, dateTo]);

  // Per-template averages, scoped to the selected date range
  const templateScores = useMemo(() => {
    const groups = {};
    rangeSubmissions.forEach(s => {
      if (!groups[s.template_id]) groups[s.template_id] = { title: s.template_title, scores: [] };
      groups[s.template_id].scores.push(s.score);
    });
    return Object.values(groups).map(g => ({
      title: g.title,
      avg: parseFloat((g.scores.reduce((a, b) => a + b, 0) / g.scores.length).toFixed(1)),
      count: g.scores.length,
      isPassing: (g.scores.reduce((a, b) => a + b, 0) / g.scores.length) >= PASS_THRESHOLD,
    })).sort((a, b) => b.avg - a.avg);
  }, [rangeSubmissions]);

  // Monthly trend
  const trendData = useMemo(() => {
    const byMonth = {};
    storeSubmissions.forEach(s => {
      const sd = s.submission_date || s.created_date;
      const month = moment(sd).utcOffset(8).format('MMM YY');
      if (!byMonth[month]) byMonth[month] = { month, scores: [], order: moment(sd).valueOf() };
      byMonth[month].scores.push(s.score);
    });
    return Object.values(byMonth)
      .sort((a, b) => a.order - b.order)
      .map(m => ({
        month: m.month,
        avg: parseFloat((m.scores.reduce((a, b) => a + b, 0) / m.scores.length).toFixed(1)),
        count: m.scores.length,
      }));
  }, [storeSubmissions]);

  if (!user) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-[#1fd655]" /></div>;

  if (storeNames.length === 0) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-400">Store analytics are only available for store accounts.</p>
    </div>
  );

  return (
    <div className="app-page app-page-narrow">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Store performance</p>
          <div>
            <h1 className="app-page-heading">Store analytics</h1>
            {/*}
            <p className="text-sm text-slate-500">
              {selectedStore === 'all' ? storeNames.join(', ') : selectedStore} · Audit performance summary
            </p>
            */}
        </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {isStoreManager && storeNames.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Store</span>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-[200px] h-10 border-slate-200">
                  <SelectValue placeholder="Select store" />
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
          <ExcelExportButton onClick={handleExportExcel} disabled={storeSubmissions.length === 0} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : storeSubmissions.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No audit submissions yet for your store.</p>
            <p className="text-slate-400 text-sm mt-1">Complete an audit to see your analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overall Average</p>
                <p className={`text-3xl font-extrabold ${stats.avg >= PASS_THRESHOLD ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.avg.toFixed(1)}%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {stats.trend > 1 ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : stats.trend < -1 ? <TrendingDown className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-xs text-slate-400">vs last audit</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Audits</p>
                <p className="text-3xl font-extrabold text-slate-900">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Passing</p>
                <p className="text-3xl font-extrabold text-green-600">{stats.passing}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Failing</p>
                <p className="text-3xl font-extrabold text-red-600">{stats.failing}</p>
              </CardContent>
            </Card>
          </div>

          {/* Checklist Completion Rate */}
          <ChecklistCompletionCard
            templates={completionTemplates}
            submissions={storeSubmissions}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            isAdmin={isAdmin}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
            saving={saving}
            storeNames={storeNames}
            selectedStore={selectedStore}
            onStoreChange={setSelectedStore}
          />

          {/* Score Trend */}
          {trendData.length > 1 && (
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1fd655]" /> Score Trend Over Time
                </p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => `${v}%`} />
                    <Line type="monotone" dataKey="avg" stroke="#1fd655" strokeWidth={2.5} dot={{ r: 4, fill: '#1fd655' }} name="Avg Score" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Per-Template Scores */}
          {templateScores.length > 0 && (
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-[#1fd655]" /> Score by Template
                </p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={Math.max(160, templateScores.length * 48)}>
                  <BarChart data={templateScores} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="title" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => `${v}%`} />
                    <Bar dataKey="avg" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: v => `${v}%` }}>
                      {templateScores.map((t, i) => (
                        <Cell key={i} fill={t.isPassing ? '#1fd655' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Submissions */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <p className="font-bold text-slate-800">Recent Audits</p>
                <p className="text-xs text-slate-400">{recentAudits.length} total</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Range</span>
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={e => setAuditDateFrom(e.target.value)}
                  className="h-9 px-2 py-1 text-sm rounded-md border border-slate-200 bg-white text-slate-700"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={e => setAuditDateTo(e.target.value)}
                  className="h-9 px-2 py-1 text-sm rounded-md border border-slate-200 bg-white text-slate-700"
                />
                {(auditDateFrom || auditDateTo) && (
                  <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setAuditDateFrom(''); setAuditDateTo(''); }}>
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Template</th>
                      <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Store</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Score</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">YES</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">NO</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">N/A</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-right px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center px-5 py-10 text-slate-400 text-sm">No audits in the selected date range.</td>
                      </tr>
                    ) : pagedSubmissions.map((s, i) => (
                      <tr key={s.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className="px-5 py-3 font-medium text-slate-800">{s.template_title}</td>
                        <td className="px-3 py-3 text-slate-600 text-xs">{s.brand || '—'}</td>
                        <td className="text-center px-3 py-3"><ScoreBadge score={s.score} /></td>
                        <td className="text-center px-3 py-3">
                          <span className="flex items-center justify-center gap-1 text-green-600 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />{s.yes_count}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className="flex items-center justify-center gap-1 text-red-500 font-semibold text-xs">
                            <XCircle className="w-3.5 h-3.5" />{s.no_count}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3 text-slate-400 text-xs">{s.na_count}</td>
                        <td className="text-center px-3 py-3">
                          <Badge className={s.score >= PASS_THRESHOLD ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
                            {s.score >= PASS_THRESHOLD ? 'PASS' : 'FAIL'}
                          </Badge>
                        </td>
                        <td className="text-right px-5 py-3 text-slate-500 text-xs">{formatPHDateTime(s.submission_date || s.created_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-5 pt-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Show</span>
                  <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
