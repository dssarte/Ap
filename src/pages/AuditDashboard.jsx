import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Store, ClipboardCheck, Trophy, AlertTriangle, CalendarDays, Ticket } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import moment from 'moment';
import NoAnswerTracker from '@/components/audit/NoAnswerTracker';
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';
import { auditBusinessDayKey } from '@/lib/dateUtils';

const PASS_THRESHOLD = 75;
const COLORS = ['#1fd655', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function isOdChecklist(title) {
  return (title || '').trim().toUpperCase().includes('OD CHECKLIST');
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-slate-300 text-sm">—</span>;
  const cls = score >= 80
    ? 'bg-green-100 text-green-700 border-green-200'
    : score >= PASS_THRESHOLD
    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${cls}`}>
      {score.toFixed(1)}%
    </span>
  );
}

function TrendIcon({ trend }) {
  if (trend > 1) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend < -1) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

export default function AuditDashboard() {
  const [user, setUser] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Store managers are scoped to their assigned stores only; admins/QA see everything
  const allowedStores = useMemo(() => {
    if (!user) return null;
    if (user.user_type === 'store_manager') {
      return Array.isArray(user.assigned_stores) ? user.assigned_stores : [];
    }
    return null; // null = no restriction
  }, [user]);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
  });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['audit-submissions-dashboard', dateFrom, dateTo, selectedTemplateId],
    queryFn: () => base44.audit.listSubmissions({
      dateFrom,
      dateTo,
      templateId: selectedTemplateId === 'all' ? null : selectedTemplateId,
      maxRows: 25000,
    }),
    enabled: !!user,
  });

  const { data: generatedTickets = [], isLoading: loadingGeneratedTickets } = useQuery({
    queryKey: ['audit-generated-tickets-dashboard', dateFrom, dateTo],
    queryFn: () => base44.audit.listGeneratedTickets({ dateFrom, dateTo, maxRows: 25000 }),
    enabled: !!user,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['audit-templates-all'],
    queryFn: () => base44.entities.AuditTemplate.filter({ is_active: true }, 'title', 200),
  });

  // Include inactive templates when resolving historical answer IDs. The
  // template filter above intentionally remains limited to active templates.
  const { data: templateDefinitions = [] } = useQuery({
    queryKey: ['audit-template-definitions-no-analysis'],
    queryFn: () => base44.entities.AuditTemplate.list('title', 500),
  });

  // Brands visible to this user (store managers only see brands tied to their assigned stores)
  const visibleBrands = useMemo(() => {
    if (!allowedStores) return brands;
    return brands.filter(b => allowedStores.some(name => name.includes(b.brand_name) || b.brand_name.includes(name)));
  }, [brands, allowedStores]);

  // Filter submissions
  const filtered = useMemo(() => {
    let subs = submissions.filter(s => s.score != null);
    // Scope store managers to their assigned stores
    if (allowedStores) {
      subs = subs.filter(s => allowedStores.some(name => s.brand?.includes(name)));
    }
    if (selectedBrandId !== 'all') {
      const brand = brands.find(b => b.id === selectedBrandId);
      if (brand) subs = subs.filter(s => s.brand && s.brand.startsWith(brand.brand_name));
    }
    if (selectedTemplateId !== 'all') {
      subs = subs.filter(s => s.template_id === selectedTemplateId);
    }
    if (dateFrom || dateTo) {
      subs = subs.filter(s => {
        const k = auditBusinessDayKey(s);
        if (dateFrom && k < dateFrom) return false;
        if (dateTo && k > dateTo) return false;
        return true;
      });
    }
    return subs;
  }, [submissions, brands, allowedStores, selectedBrandId, selectedTemplateId, dateFrom, dateTo]);

  const filteredSubmissionIds = useMemo(
    () => new Set(filtered.map(submission => submission.id)),
    [filtered]
  );

  const filteredAuditTickets = useMemo(
    () => generatedTickets.filter(ticket => filteredSubmissionIds.has(ticket.audit_submission_id)),
    [generatedTickets, filteredSubmissionIds]
  );

  // Performance for every audit template represented by the current filters.
  // Unlike the headline score, this deliberately includes OD checklists so the
  // template analysis is complete.
  const templateRows = useMemo(() => {
    const groups = new Map();
    filtered.forEach(submission => {
      const key = submission.template_id || submission.template_title || 'unknown';
      const group = groups.get(key) || {
        id: key,
        title: submission.template_title || 'Untitled template',
        scores: [],
        audits: 0,
        passing: 0,
        failing: 0,
        noFindings: 0,
        tickets: 0,
      };
      const score = Number(submission.score);
      if (Number.isFinite(score)) group.scores.push(score);
      group.audits += 1;
      if (score >= PASS_THRESHOLD) group.passing += 1;
      else group.failing += 1;
      group.noFindings += Number(submission.no_count || 0);
      groups.set(key, group);
    });

    filteredAuditTickets.forEach(ticket => {
      const group = groups.get(ticket.audit_template_id);
      if (group) group.tickets += 1;
    });

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        avg: group.scores.length
          ? group.scores.reduce((total, score) => total + score, 0) / group.scores.length
          : null,
        passRate: group.audits ? (group.passing / group.audits) * 100 : 0,
      }))
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.audits - a.audits || a.title.localeCompare(b.title));
  }, [filtered, filteredAuditTickets]);

  const topTemplate = templateRows.find(row => row.avg != null) || null;
  const bottomTemplate = [...templateRows].reverse().find(row => row.avg != null) || null;
  const noTemplateRows = useMemo(
    () => [...templateRows].sort((a, b) => b.noFindings - a.noFindings || b.tickets - a.tickets || a.title.localeCompare(b.title)),
    [templateRows]
  );
  const mostNoTemplate = noTemplateRows.find(row => row.noFindings > 0) || null;

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

  // Rank every individual checklist item marked NO. Identically named items
  // in the same section are combined across templates, while the contributing
  // templates and exact stores remain visible in the detail columns.
  const noItemRows = useMemo(() => {
    const groups = new Map();

    filtered.forEach(submission => {
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
        };
        const storeName = submission.brand || 'Unknown store';
        group.count += 1;
        group.stores.set(storeName, (group.stores.get(storeName) || 0) + 1);
        group.templates.add(definition.template || submission.template_title || 'Untitled template');
        groups.set(groupKey, group);
      });
    });

    return Array.from(groups.values())
      .map(group => {
        const storeEntries = Array.from(group.stores.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        return {
          ...group,
          storeCount: storeEntries.length,
          storeSummary: storeEntries.map(([store, count]) => `${store} (${count})`).join(', '),
          templateSummary: Array.from(group.templates).sort().join(', '),
        };
      })
      .sort((a, b) => b.count - a.count || b.storeCount - a.storeCount || a.label.localeCompare(b.label));
  }, [filtered, auditItemLookup]);

  const topNoItem = noItemRows[0] || null;
  const topNoItemChartRows = noItemRows.slice(0, 15);

  const dailyRows = useMemo(() => {
    const groups = new Map();
    filtered.forEach(submission => {
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

    const submissionDay = new Map(filtered.map(submission => [submission.id, auditBusinessDayKey(submission)]));
    filteredAuditTickets.forEach(ticket => {
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
  }, [filtered, filteredAuditTickets]);

  const noTrend = useMemo(() => {
    const total = dailyRows.reduce((sum, row) => sum + row.noFindings, 0);
    if (dailyRows.length < 2) return { direction: 'stable', delta: 0, total, earlyAverage: total, recentAverage: total };
    const midpoint = Math.ceil(dailyRows.length / 2);
    const early = dailyRows.slice(0, midpoint);
    const recent = dailyRows.slice(midpoint);
    const average = rows => rows.length
      ? rows.reduce((sum, row) => sum + row.noFindings, 0) / rows.length
      : 0;
    const earlyAverage = average(early);
    const recentAverage = average(recent);
    const delta = recentAverage - earlyAverage;
    return {
      total,
      earlyAverage,
      recentAverage,
      delta,
      direction: delta > 0.5 ? 'rising' : delta < -0.5 ? 'falling' : 'stable',
    };
  }, [dailyRows]);

  const auditDistribution = useMemo(
    () => templateRows.map((row, index) => ({ ...row, fill: COLORS[index % COLORS.length] })),
    [templateRows]
  );

  const outcomeDistribution = useMemo(() => [
    { name: 'Passing', value: filtered.filter(row => Number(row.score) >= PASS_THRESHOLD).length, fill: '#16a34a' },
    { name: 'Failing', value: filtered.filter(row => Number(row.score) < PASS_THRESHOLD).length, fill: '#ef4444' },
  ].filter(item => item.value > 0), [filtered]);

  // Summary stats
  const stats = useMemo(() => {
    if (!filtered.length) return null;
    // Headline analytics include every audit template represented by the
    // selected filters. Store comparison below retains its established rule
    // of excluding the operational OD checklist from quality averages.
    const avg = filtered.reduce((sum, submission) => sum + Number(submission.score || 0), 0) / filtered.length;
    const passing = filtered.filter(s => s.score >= PASS_THRESHOLD).length;
    const stores = new Set(filtered.map(s => s.brand)).size;
    const templatesUsed = new Set(filtered.map(s => s.template_id)).size;
    return {
      avg,
      passing,
      failing: filtered.length - passing,
      total: filtered.length,
      stores,
      templatesUsed,
      tickets: filteredAuditTickets.length,
    };
  }, [filtered, filteredAuditTickets]);

  // Per-store summary table
  const storeRows = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const key = s.brand;
      if (!groups[key]) groups[key] = { store: key, scores: [], avgScores: [], byTemplate: {} };
      groups[key].scores.push(s.score);
      if (!isOdChecklist(s.template_title)) {
        groups[key].avgScores.push(s.score);
      }
      if (!groups[key].byTemplate[s.template_id]) {
        groups[key].byTemplate[s.template_id] = { title: s.template_title, scores: [] };
      }
      groups[key].byTemplate[s.template_id].scores.push(s.score);
    });
    return Object.values(groups)
      .map(g => {
        const avg = g.avgScores.length ? g.avgScores.reduce((a, b) => a + b, 0) / g.avgScores.length : null;
        const sorted = [...g.avgScores];
        const mid = Math.floor(sorted.length / 2);
        const early = sorted.slice(0, mid);
        const late = sorted.slice(mid);
        const earlyAvg = early.length ? early.reduce((a, b) => a + b, 0) / early.length : avg;
        const lateAvg = late.length ? late.reduce((a, b) => a + b, 0) / late.length : avg;
        const trend = (earlyAvg != null && lateAvg != null) ? lateAvg - earlyAvg : 0;
        const templateScores = Object.values(g.byTemplate).map(t => ({
          title: t.title,
          avg: t.scores.reduce((a, b) => a + b, 0) / t.scores.length,
        }));
        return { store: g.store, avg, trend, count: g.scores.length, templateScores, isPassing: avg == null ? null : avg >= PASS_THRESHOLD };
      })
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [filtered]);

  // All unique template titles visible in current filter
  const visibleTemplates = useMemo(() => {
    const seen = new Set();
    const out = [];
    storeRows.forEach(r => r.templateScores.forEach(t => {
      if (!seen.has(t.title)) { seen.add(t.title); out.push(t.title); }
    }));
    return out;
  }, [storeRows]);

  // Trend over time (grouped by month)
  const trendData = useMemo(() => {
    const byMonth = {};
    filtered.forEach(s => {
      const month = moment(auditBusinessDayKey(s), 'YYYY-MM-DD').format('MMM YYYY');
      if (!byMonth[month]) byMonth[month] = { month, scores: {}, totals: [] };
      byMonth[month].totals.push(s.score);
      if (!byMonth[month].scores[s.template_id]) {
        byMonth[month].scores[s.template_id] = { title: s.template_title, vals: [] };
      }
      byMonth[month].scores[s.template_id].vals.push(s.score);
    });
    return Object.values(byMonth)
      .sort((a, b) => moment(a.month, 'MMM YYYY') - moment(b.month, 'MMM YYYY'))
      .map(m => {
        const row = { month: m.month, Overall: parseFloat((m.totals.reduce((a, b) => a + b, 0) / m.totals.length).toFixed(1)) };
        Object.values(m.scores).forEach(t => {
          row[t.title] = parseFloat((t.vals.reduce((a, b) => a + b, 0) / t.vals.length).toFixed(1));
        });
        return row;
      });
  }, [filtered]);

  const trendKeys = useMemo(() => {
    const keys = new Set();
    trendData.forEach(d => Object.keys(d).filter(k => k !== 'month').forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [trendData]);

  const handleExportExcel = () => {
    const brandLabel = selectedBrandId === 'all' ? 'All Brands' : (brands.find(b => b.id === selectedBrandId)?.brand_name || 'All Brands');
    const sheets = [
      {
        name: 'Store Performance',
        title: `Store Performance Breakdown — ${brandLabel} · ${dateFrom} to ${dateTo}`,
        headers: ['Store', ...visibleTemplates, 'Avg', 'Trend', 'Audits', 'Status'],
        rows: storeRows.map(r => [
          r.store,
          ...visibleTemplates.map(title => {
            const ts = r.templateScores.find(t => t.title === title);
            return ts ? `${ts.avg.toFixed(1)}%` : '—';
          }),
          r.avg != null ? `${r.avg.toFixed(1)}%` : '—',
          r.trend > 1 ? `+${r.trend.toFixed(1)}` : r.trend < -1 ? r.trend.toFixed(1) : '—',
          r.count,
          r.isPassing == null ? '—' : (r.isPassing ? 'PASS' : 'FAIL'),
        ]),
      },
      {
        name: 'Template Analytics',
        title: `Audit Template Analytics — ${brandLabel} · ${dateFrom} to ${dateTo}`,
        headers: ['Template', 'Average Score', 'Audits', 'Passing', 'Failing', 'Pass Rate', 'NO Findings', 'Generated Tickets'],
        rows: templateRows.map(row => [
          row.title,
          row.avg != null ? `${row.avg.toFixed(1)}%` : '—',
          row.audits,
          row.passing,
          row.failing,
          `${row.passRate.toFixed(1)}%`,
          row.noFindings,
          row.tickets,
        ]),
      },
      {
        name: 'NO Analysis',
        title: `NO Findings by Template — ${brandLabel} · ${dateFrom} to ${dateTo}`,
        headers: ['NO Rank', 'Template', 'NO Findings', 'Generated Tickets', 'Audits', 'Average Score'],
        rows: noTemplateRows.map((row, index) => [
          index + 1,
          row.title,
          row.noFindings,
          row.tickets,
          row.audits,
          row.avg != null ? `${row.avg.toFixed(1)}%` : '—',
        ]),
      },
      {
        name: 'NO Item Details',
        title: `Checklist Item NO Summary — ${brandLabel} · ${dateFrom} to ${dateTo}`,
        headers: ['NO Rank', 'Area / Section', 'Checklist Item', 'Templates', 'Total NO', 'Stores Affected', 'Store Breakdown'],
        rows: noItemRows.map((row, index) => [
          index + 1,
          row.section,
          row.item,
          row.templateSummary,
          row.count,
          row.storeCount,
          row.storeSummary,
        ]),
      },
      {
        name: 'Daily Summary',
        title: `Daily Audit Summary — ${brandLabel} · ${dateFrom} to ${dateTo} · NO trend: ${noTrend.direction}`,
        headers: ['Business Date', 'Average Score', 'Audits', 'Passing', 'Failing', 'NO Findings', 'Generated Tickets'],
        rows: [...dailyRows].reverse().map(row => [
          row.day,
          row.avg != null ? `${row.avg.toFixed(1)}%` : '—',
          row.audits,
          row.passing,
          row.failing,
          row.noFindings,
          row.tickets,
        ]),
      },
    ];
    exportSheetsToExcel('Audit_Dashboard_Store_Performance', sheets);
  };

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Quality intelligence</p>
          <div>
            <h1 className="app-page-heading">Audit Dashboard</h1>
            <p className="app-page-description">Store quality performance summary.</p>
          </div>
        </div>
        <ExcelExportButton onClick={handleExportExcel} disabled={filtered.length === 0} />
      </div>

      {/* Filters */}
      <div className="app-filter-bar">
        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {visibleBrands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
          <SelectTrigger className="w-56 h-9">
            <SelectValue placeholder="All Templates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
          <span className="hidden text-sm text-slate-400 sm:inline">–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
        </div>
      </div>

      {isLoading || loadingGeneratedTickets ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : !filtered.length ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No audit submissions found for the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Overall Avg Score', value: stats.avg != null ? `${stats.avg.toFixed(1)}%` : '—', color: stats.avg != null && stats.avg >= PASS_THRESHOLD ? 'text-green-600' : 'text-red-600' },
              { label: 'Total Audits', value: stats.total, color: 'text-slate-900' },
              { label: 'Passing', value: stats.passing, color: 'text-green-600' },
              { label: 'Failing', value: stats.failing, color: 'text-red-600' },
              { label: 'Templates Used', value: stats.templatesUsed, color: 'text-blue-600' },
              { label: 'Audit Tickets', value: stats.tickets, color: 'text-violet-600' },
            ].map(k => (
              <Card key={k.label} className="border border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className={`text-3xl font-extrabold ${k.color}`}>{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Highest and lowest performing templates — hidden per request, restore by removing the `false &&` guard */}
          {false && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border border-emerald-200 bg-emerald-50/60 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-emerald-100 p-3"><Trophy className="h-6 w-6 text-emerald-700" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Top-performing template</p>
                  <p className="mt-1 truncate font-bold text-slate-900">{topTemplate?.title || 'No scored template'}</p>
                  <p className="mt-1 text-sm text-slate-600">{topTemplate ? `${topTemplate.avg.toFixed(1)}% average · ${topTemplate.audits} audit${topTemplate.audits !== 1 ? 's' : ''} · ${topTemplate.tickets} ticket${topTemplate.tickets !== 1 ? 's' : ''}` : '—'}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-rose-200 bg-rose-50/60 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-rose-100 p-3"><AlertTriangle className="h-6 w-6 text-rose-700" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Bottom-performing template</p>
                  <p className="mt-1 truncate font-bold text-slate-900">{bottomTemplate?.title || 'No scored template'}</p>
                  <p className="mt-1 text-sm text-slate-600">{bottomTemplate ? `${bottomTemplate.avg.toFixed(1)}% average · ${bottomTemplate.audits} audit${bottomTemplate.audits !== 1 ? 's' : ''} · ${bottomTemplate.tickets} ticket${bottomTemplate.tickets !== 1 ? 's' : ''}` : '—'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* NO findings headline analytics */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="border border-red-200 bg-red-50/60 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-red-700">Total NO findings</p>
                <p className="mt-2 text-3xl font-extrabold text-red-700">{noTrend.total}</p>
                <p className="mt-1 text-xs text-slate-500">Across all templates in the selected date range</p>
              </CardContent>
            </Card>
            {/* Template with most NO — hidden per request, restore by removing the `false &&` guard */}
            {false && (
            <Card className="border border-amber-200 bg-amber-50/60 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Template with most NO</p>
                <p className="mt-2 truncate text-lg font-bold text-slate-900">{mostNoTemplate?.title || 'No NO findings'}</p>
                <p className="mt-1 text-sm text-slate-600">{mostNoTemplate ? `${mostNoTemplate.noFindings} NO · ${mostNoTemplate.tickets} generated ticket${mostNoTemplate.tickets !== 1 ? 's' : ''}` : '—'}</p>
              </CardContent>
            </Card>
            )}
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

          {/* NO findings graphs */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> NO Findings by Template</p>
                <p className="text-xs text-slate-500">All templates ranked from the most NO findings to the least.</p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={Math.max(260, noTemplateRows.length * 40)}>
                  <BarChart data={noTemplateRows} layout="vertical" margin={{ left: 12, right: 42 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="title" width={170} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value, name) => [value, name === 'noFindings' ? 'NO findings' : name]} />
                    <Bar dataKey="noFindings" name="NO findings" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11 }}>
                      {noTemplateRows.map((row, index) => <Cell key={row.id} fill={index === 0 && row.noFindings > 0 ? '#dc2626' : row.noFindings > 0 ? '#f97316' : '#cbd5e1'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Daily NO Trend — hidden per request, restore by removing the `false &&` guard. The Daily Audit and Ticket Summary card now takes this slot instead. */}
            {false && (
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-red-500" /> Daily NO Trend</p>
                <p className="text-xs text-slate-500">Shows whether all NO findings are increasing or decreasing across the selected date range.</p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyRows} margin={{ top: 10, right: 24, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.day || ''} formatter={(value, name) => [value, name]} />
                    <Legend />
                    <Line type="monotone" dataKey="noFindings" name="NO findings" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="tickets" name="Generated tickets" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            )}

            {/* Daily Audit and Ticket Summary — moved here from further down, into the freed-up Daily NO Trend slot */}
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#1fd655]" /> Daily Audit and Ticket Summary</p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyRows} margin={{ top: 8, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.day || ''} />
                    <Legend />
                    <Bar dataKey="audits" name="Audits" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tickets" name="Generated tickets" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* All-template analytics table — moved up, directly below Daily Audit and Ticket Summary */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><Ticket className="w-4 h-4 text-[#1fd655]" /> All Template Analytics</p>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {['Rank', 'Template', 'Average', 'Audits', 'Pass', 'Fail', 'Pass rate', 'NO findings', 'Tickets'].map(header => <th key={header} className={`${header === 'Template' ? 'text-left' : 'text-center'} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600`}>{header}</th>)}
                  </tr></thead>
                  <tbody>{templateRows.map((row, index) => <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.title}</td>
                    <td className="px-4 py-3 text-center"><ScoreBadge score={row.avg} /></td>
                    <td className="px-4 py-3 text-center">{row.audits}</td>
                    <td className="px-4 py-3 text-center text-green-600">{row.passing}</td>
                    <td className="px-4 py-3 text-center text-red-600">{row.failing}</td>
                    <td className="px-4 py-3 text-center">{row.passRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center text-amber-600">{row.noFindings}</td>
                    <td className="px-4 py-3 text-center font-semibold text-violet-600">{row.tickets}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Daily summary table — moved up, directly below All Template Analytics */}
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
              <p className="text-xs text-slate-500">Examples include MIS — POS, CCTV, BMD — Pizza Oven, Sales Performance, and Manager Daily Focus. The chart shows the top 15; the complete ranked list and every affected store appear below.</p>
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
                <p className="py-12 text-center text-sm text-slate-400">No checklist items were marked NO for the selected filters.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800">Complete Checklist Item NO Summary</p>
              <p className="text-xs text-slate-500">All NO answers in the selected date range, with total occurrences and the stores where each finding appeared.</p>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {['Rank', 'Area / Section', 'Checklist Item', 'Template', 'Total NO', 'Stores', 'Store Breakdown'].map(header => (
                      <th key={header} className={`${['Area / Section', 'Checklist Item', 'Template', 'Store Breakdown'].includes(header) ? 'text-left' : 'text-center'} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600`}>{header}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {noItemRows.map((row, index) => (
                      <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-4 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.section}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{row.item}</td>
                        <td className="max-w-[240px] px-4 py-3 text-slate-600">{row.templateSummary}</td>
                        <td className="px-4 py-3 text-center text-lg font-extrabold text-red-600">{row.count}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.storeCount}</td>
                        <td className="min-w-[320px] px-4 py-3 leading-6 text-slate-600">{row.storeSummary}</td>
                      </tr>
                    ))}
                    {!noItemRows.length && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No checklist items were marked NO for the selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Template bar graph (Average Score by Audit Template) — hidden per request, restore by removing the `false &&` guard */}
          {false && (
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#1fd655]" /> Average Score by Audit Template</p>
              <p className="text-xs text-slate-500">Every template in the selected date range, ordered from top to bottom.</p>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              <ResponsiveContainer width="100%" height={Math.max(240, templateRows.length * 42)}>
                <BarChart data={templateRows.map(row => ({ ...row, score: row.avg != null ? Number(row.avg.toFixed(1)) : 0 }))} layout="vertical" margin={{ left: 12, right: 42 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={value => `${value}%`} />
                  <YAxis type="category" dataKey="title" width={170} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name) => [name === 'score' ? `${value}%` : value, name === 'score' ? 'Average score' : name]} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: value => `${value}%` }}>
                    {templateRows.map(row => <Cell key={row.id} fill={(row.avg ?? 0) >= PASS_THRESHOLD ? '#16a34a' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          )}

          {/* Pie graphs (Audit Volume by Template, Pass and Fail Distribution) — hidden per request, restore by removing the `false &&` guard */}
          {false && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800">Audit Volume by Template</p>
              </CardHeader>
              <CardContent className="pb-5">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={auditDistribution} dataKey="audits" nameKey="title" cx="50%" cy="48%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine />
                    <Tooltip formatter={(value) => [`${value} audit${value !== 1 ? 's' : ''}`, 'Volume']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800">Pass and Fail Distribution</p>
              </CardHeader>
              <CardContent className="pb-5">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={outcomeDistribution} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={58} outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                      {outcomeDistribution.map(item => <Cell key={item.name} fill={item.fill} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} audit${value !== 1 ? 's' : ''}`, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Score Trend Chart */}
          {trendData.length > 1 && (
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <p className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#1fd655]" /> Score Trend Over Time</p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => `${v}%`} />
                    <Legend />
                    {trendKeys.map((key, i) => (
                      <Line key={key} type="monotone" dataKey={key}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={key === 'Overall' ? 3 : 1.5}
                        dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Per-store Bar Chart (Average Score by Store) — hidden per request, restore by removing the `false &&` guard */}
          {false && (
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><Store className="w-4 h-4 text-[#1fd655]" /> Average Score by Store</p>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              <ResponsiveContainer width="100%" height={Math.max(220, storeRows.length * 36)}>
                <BarChart data={storeRows.map(r => ({ name: r.store, score: r.avg != null ? parseFloat(r.avg.toFixed(1)) : 0, isPassing: r.isPassing }))}
                  layout="vertical" margin={{ left: 8, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: v => `${v}%` }}>
                    {storeRows.map((r, i) => (
                      <Cell key={i} fill={r.isPassing == null ? '#cbd5e1' : (r.isPassing ? '#1fd655' : '#ef4444')} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          )}

          {/* Detailed Store Table */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800">Store Performance Breakdown</p>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Store</th>
                      {visibleTemplates.map(t => (
                        <th key={t} className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">{t}</th>
                      ))}
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Avg</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Trend</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Audits</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeRows.map((r, i) => (
                      <tr key={r.store} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-slate-50`}>
                        <td className="px-5 py-3 font-semibold text-slate-800">{r.store}</td>
                        {visibleTemplates.map(title => {
                          const ts = r.templateScores.find(t => t.title === title);
                          return (
                            <td key={title} className="text-center px-3 py-3">
                              <ScoreBadge score={ts?.avg ?? null} />
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-3"><ScoreBadge score={r.avg} /></td>
                        <td className="text-center px-3 py-3 flex justify-center"><TrendIcon trend={r.trend} /></td>
                        <td className="text-center px-3 py-3 text-slate-500 text-xs">{r.count}</td>
                        <td className="text-center px-3 py-3">
  {r.isPassing == null ? (
    <span className="text-slate-300 text-sm">—</span>
  ) : (
    <Badge className={r.isPassing ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
      {r.isPassing ? 'PASS' : 'FAIL'}
    </Badge>
  )}
</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* NO Answer Tracker */}
          <NoAnswerTracker allowedStores={allowedStores} />
        </>
      )}
    </div>
  );
}
