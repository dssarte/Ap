import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Minus, ClipboardCheck, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileText, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import moment from 'moment';
import SubmissionDetail from '@/components/audit/SubmissionDetail';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect } from 'react';
import { auditBusinessDayKey, formatPHDateTime } from '@/lib/dateUtils';
import ChecklistCompletionCard from '@/components/audit/ChecklistCompletionCard';
import NoAnswerTracker from '@/components/audit/NoAnswerTracker';
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
  const [selectedSubmission, setSelectedSubmission] = useState(null);
const submissionDetailRef = useRef(null);
const [exportingSubmissionPdf, setExportingSubmissionPdf] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const storeNames = useMemo(() => {
    if (!user) return [];
    if (user.user_type === 'store_manager') return user.assigned_stores || [];
    if (user.store_name) return [user.store_name];
    return [];
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

  // Full template definitions (including inactive) for resolving NO-answer item labels
  const { data: templateDefinitions = [] } = useQuery({
    queryKey: ['audit-template-definitions-store-analytics'],
    queryFn: () => base44.entities.AuditTemplate.list('title', 500),
    enabled: storeNames.length > 0,
  });

  // Tickets generated from this store's audits, for the Daily Summary table
  const { data: generatedTickets = [] } = useQuery({
    queryKey: ['audit-generated-tickets-store-analytics', dateFrom, dateTo],
    queryFn: () => base44.audit.listGeneratedTickets({ dateFrom, dateTo, maxRows: 25000 }),
    enabled: storeNames.length > 0 && !!dateFrom && !!dateTo,
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
      const k = auditBusinessDayKey(s);
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
      const k = auditBusinessDayKey(s);
      return k >= dateFrom && k <= dateTo;
    });
  }, [storeSubmissions, dateFrom, dateTo]);

  // Resolve checklist item ids to their section/label for NO-answer grouping
  const auditItemLookup = useMemo(() => {
    const lookup = new Map();
    templateDefinitions.forEach(template => {
      (template.sections || []).forEach(section => {
        (section.items || []).forEach(item => {
          lookup.set(`${template.id}::${item.id}`, {
            section: section.title || 'General',
            item: item.label || item.id || 'Unlabelled checklist item',
            template: template.title || 'Untitled template',
          });
        });
      });
    });
    return lookup;
  }, [templateDefinitions]);

  // Rank every individual checklist item marked NO, combining identically named
  // items in the same section across templates
  const noItemRows = useMemo(() => {
    const groups = new Map();
    rangeSubmissions.forEach(submission => {
      Object.entries(submission.answers || {}).forEach(([itemId, answer]) => {
        if (String(answer || '').trim().toUpperCase() !== 'NO') return;

        const definition = auditItemLookup.get(`${submission.template_id}::${itemId}`) || {
          section: 'Unmapped section',
          item: itemId || 'Unlabelled checklist item',
          template: submission.template_title || 'Untitled template',
        };
        const section = String(definition.section || 'General').trim();
        const item = String(definition.item || itemId || 'Unlabelled checklist item').trim();
        const groupKey = `${section.toLocaleLowerCase()}::${item.toLocaleLowerCase()}`;
        const group = groups.get(groupKey) || {
          id: groupKey,
          section,
          item,
          label: `${section} — ${item}`,
          count: 0,
          stores: new Map(),
          templates: new Set(),
          occurrences: [],
        };
        const storeName = submission.brand || 'Unknown store';
        group.count += 1;
        group.stores.set(storeName, (group.stores.get(storeName) || 0) + 1);
        group.templates.add(definition.template || submission.template_title || 'Untitled template');
        group.occurrences.push(moment(submission.submission_date || submission.created_date));
        groups.set(groupKey, group);
      });
    });

    return Array.from(groups.values())
      .map(group => {
        const storeEntries = Array.from(group.stores.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const dateLabels = group.occurrences
          .slice()
          .sort((a, b) => a.valueOf() - b.valueOf())
          .map(m => m.format('MMM D, YYYY, h:mm A'));
        return {
          ...group,
          storeCount: storeEntries.length,
          storeSummary: storeEntries.map(([store, count]) => `${store} (${count})`).join(', '),
          templateSummary: Array.from(group.templates).sort().join(', '),
          dateLabels,
        };
      })
      .sort((a, b) => b.count - a.count || b.storeCount - a.storeCount || a.label.localeCompare(b.label));
  }, [rangeSubmissions, auditItemLookup]);

  const topNoItem = noItemRows[0] || null;
  const topNoItemChartRows = noItemRows.slice(0, 15);

  // Per-day rollup: score/pass/fail/NO-findings/ticket totals for the Daily Summary table and trend
  const dailyRows = useMemo(() => {
    const groups = new Map();
    rangeSubmissions.forEach(submission => {
      const day = auditBusinessDayKey(submission);
      if (!day) return;
      const group = groups.get(day) || { day, scores: [], audits: 0, passing: 0, failing: 0, noFindings: 0, tickets: 0 };
      const score = Number(submission.score);
      if (Number.isFinite(score)) group.scores.push(score);
      group.audits += 1;
      if (score >= PASS_THRESHOLD) group.passing += 1;
      else group.failing += 1;
      group.noFindings += Number(submission.no_count || 0);
      groups.set(day, group);
    });

    const submissionDay = new Map(rangeSubmissions.map(submission => [submission.id, auditBusinessDayKey(submission)]));
    generatedTickets.forEach(ticket => {
      const day = submissionDay.get(ticket.audit_submission_id);
      const group = groups.get(day);
      if (group) group.tickets += 1;
    });

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        avg: group.scores.length
          ? group.scores.reduce((total, score) => total + score, 0) / group.scores.length
          : null,
        label: moment(group.day, 'YYYY-MM-DD').format('MMM D'),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [rangeSubmissions, generatedTickets]);

  const noTrend = useMemo(() => {
    const total = dailyRows.reduce((sum, row) => sum + row.noFindings, 0);
    if (dailyRows.length < 2) return { direction: 'stable', delta: 0, total };
    const midpoint = Math.ceil(dailyRows.length / 2);
    const average = rows => rows.length ? rows.reduce((sum, row) => sum + row.noFindings, 0) / rows.length : 0;
    const earlyAverage = average(dailyRows.slice(0, midpoint));
    const recentAverage = average(dailyRows.slice(midpoint));
    const delta = recentAverage - earlyAverage;
    return { total, delta, direction: delta > 0.5 ? 'rising' : delta < -0.5 ? 'falling' : 'stable' };
  }, [dailyRows]);

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
      const businessDay = auditBusinessDayKey(s);
      const month = moment(businessDay, 'YYYY-MM-DD').format('MMM YY');
      if (!byMonth[month]) byMonth[month] = { month, scores: [], order: moment(businessDay, 'YYYY-MM-DD').valueOf() };
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

          {/* NO findings headline analytics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-red-200 bg-red-50/60 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-red-700">Total NO findings</p>
                <p className="mt-2 text-3xl font-extrabold text-red-700">{noTrend.total}</p>
                <p className="mt-1 text-xs text-slate-500">Across all templates in the selected date range</p>
              </CardContent>
            </Card>
            <Card className="border border-orange-200 bg-orange-50/60 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Top NO checklist item</p>
                <p className="mt-2 line-clamp-2 text-lg font-bold text-slate-900">{topNoItem?.label || 'No NO findings'}</p>
                <p className="mt-1 text-sm text-slate-600">{topNoItem ? `${topNoItem.count} NO · ${topNoItem.storeCount} affected store${topNoItem.storeCount !== 1 ? 's' : ''}` : '—'}</p>
              </CardContent>
            </Card>
            <Card className={`border shadow-sm ${noTrend.direction === 'rising' ? 'border-red-200 bg-red-50/60' : noTrend.direction === 'falling' ? 'border-green-200 bg-green-50/60' : 'border-slate-200 bg-slate-50/60'}`}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-xl p-3 ${noTrend.direction === 'rising' ? 'bg-red-100' : noTrend.direction === 'falling' ? 'bg-green-100' : 'bg-slate-200'}`}>
                  {noTrend.direction === 'rising' ? <TrendingUp className="h-6 w-6 text-red-700" /> : noTrend.direction === 'falling' ? <TrendingDown className="h-6 w-6 text-green-700" /> : <Minus className="h-6 w-6 text-slate-600" />}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">All-NO trend</p>
                  <p className={`mt-1 text-xl font-extrabold capitalize ${noTrend.direction === 'rising' ? 'text-red-700' : noTrend.direction === 'falling' ? 'text-green-700' : 'text-slate-700'}`}>{noTrend.direction}</p>
                  <p className="mt-1 text-xs text-slate-500">{dailyRows.length > 1 ? `${noTrend.delta >= 0 ? '+' : ''}${noTrend.delta.toFixed(1)} average NO per day` : 'Select multiple dates to calculate direction'}</p>
                </div>
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
                      <tr
     key={s.id}
     onClick={() => setSelectedSubmission(s)}
     className={`cursor-pointer transition-colors hover:bg-emerald-50/60 border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}
   >
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

          {/* Daily Summary */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5"><p className="font-bold text-slate-800">Daily Summary</p></CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50">
                  {['Business date', 'Average', 'Audits', 'Pass', 'Fail', 'NO findings', 'Tickets'].map(header => <th key={header} className={`${header === 'Business date' ? 'text-left' : 'text-center'} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600`}>{header}</th>)}
                </tr></thead>
                <tbody>{[...dailyRows].reverse().map(row => <tr key={row.day} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{moment(row.day, 'YYYY-MM-DD').format('MMM D, YYYY')}</td>
                  <td className="px-4 py-3 text-center"><ScoreBadge score={row.avg} /></td>
                  <td className="px-4 py-3 text-center">{row.audits}</td>
                  <td className="px-4 py-3 text-center text-green-600">{row.passing}</td>
                  <td className="px-4 py-3 text-center text-red-600">{row.failing}</td>
                  <td className="px-4 py-3 text-center text-amber-600">{row.noFindings}</td>
                  <td className="px-4 py-3 text-center font-semibold text-violet-600">{row.tickets}</td>
                </tr>)}</tbody>
              </table></div>
            </CardContent>
          </Card>

          {/* Individual checklist-item NO analysis */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Top NO Findings by Checklist Item</p>
              <p className="text-xs text-slate-500">The chart shows the top 15; the complete ranked list and every affected store appear below.</p>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              {topNoItemChartRows.length ? (
                <ResponsiveContainer width="100%" height={Math.max(300, topNoItemChartRows.length * 42)}>
                  <BarChart data={topNoItemChartRows} layout="vertical" margin={{ left: 12, right: 42 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={210} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [value, 'NO findings']}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload;
                        return row ? `${row.label} · ${row.storeCount} affected store${row.storeCount !== 1 ? 's' : ''}` : '';
                      }}
                    />
                    <Bar dataKey="count" name="NO findings" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11 }}>
                      {topNoItemChartRows.map((row, index) => <Cell key={row.id} fill={index === 0 ? '#dc2626' : index < 5 ? '#f97316' : '#f59e0b'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-slate-400">No checklist items were marked NO for your store.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800">Complete Checklist Item NO Summary</p>
              <p className="text-xs text-slate-500">All NO answers in the selected date range, with total occurrences and affected stores.</p>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {['Rank', 'Date', 'Area / Section', 'Checklist Item', 'Template', 'Total NO', 'Stores', 'Store Breakdown'].map(header => (
                      <th key={header} className={`${['Area / Section', 'Checklist Item', 'Template', 'Store Breakdown'].includes(header) ? 'text-left' : 'text-center'} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600`}>{header}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {noItemRows.map((row, index) => (
                      <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-4 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.dateLabels.length ? row.dateLabels.map((label, i) => (
                            <div key={i} className="whitespace-nowrap">{label}</div>
                          )) : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.section}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{row.item}</td>
                        <td className="max-w-[240px] px-4 py-3 text-slate-600">{row.templateSummary}</td>
                        <td className="px-4 py-3 text-center text-lg font-extrabold text-red-600">{row.count}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.storeCount}</td>
                        <td className="min-w-[320px] px-4 py-3 leading-6 text-slate-600">{row.storeSummary}</td>
                      </tr>
                    ))}
                    {!noItemRows.length && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No checklist items were marked NO for your store.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* NO Answer Tracker */}
          <NoAnswerTracker allowedStores={storeNames} showFilters={false} />
        </>
      )}
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => { if (!open) setSelectedSubmission(null); }}>
  <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
    <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 p-4 pb-3 pr-10 sm:p-6 sm:pb-4 sm:pr-12">
      <DialogTitle className="text-2xl truncate min-w-0">{selectedSubmission?.template_title}</DialogTitle>
      <Button
        onClick={() => submissionDetailRef.current?.exportPdf()}
        disabled={exportingSubmissionPdf}
        className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-bold gap-2 shrink-0"
      >
        {exportingSubmissionPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Export PDF
      </Button>
    </DialogHeader>
    <div className="flex-1 overflow-y-auto p-4 pt-0 pr-3 sm:p-6 sm:pt-0 sm:pr-5">
      {selectedSubmission && (
        <SubmissionDetail
          ref={submissionDetailRef}
          submission={selectedSubmission}
          templates={allTemplates}
          user={user}
          hideExportButton
          onExportingChange={setExportingSubmissionPdf}
        />
      )}
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
}
