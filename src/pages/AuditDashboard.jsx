import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, TrendingDown, Minus, Store, ClipboardCheck } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import moment from 'moment';
import NoAnswerTracker from '@/components/audit/NoAnswerTracker';
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';

const PASS_THRESHOLD = 75;

function dayKey(dateStr) {
  return moment(dateStr).utcOffset(8).format('YYYY-MM-DD');
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
      return user.assigned_stores?.length ? user.assigned_stores : (user.store_name ? [user.store_name] : []);
    }
    return null; // null = no restriction
  }, [user]);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
  });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['audit-submissions-dashboard'],
    queryFn: () => base44.entities.AuditSubmission.list('-created_date', 1000),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['audit-templates-all'],
    queryFn: () => base44.entities.AuditTemplate.filter({ is_active: true }, 'title', 200),
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
        const k = dayKey(s.submission_date || s.created_date);
        if (dateFrom && k < dateFrom) return false;
        if (dateTo && k > dateTo) return false;
        return true;
      });
    }
    return subs;
  }, [submissions, brands, allowedStores, selectedBrandId, selectedTemplateId, dateFrom, dateTo]);

  // Summary stats
  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const avg = filtered.reduce((s, x) => s + x.score, 0) / filtered.length;
    const passing = filtered.filter(s => s.score >= PASS_THRESHOLD).length;
    const stores = new Set(filtered.map(s => s.brand)).size;
    const templatesUsed = new Set(filtered.map(s => s.template_id)).size;
    return { avg, passing, failing: filtered.length - passing, total: filtered.length, stores, templatesUsed };
  }, [filtered]);

  // Per-store summary table
  const storeRows = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const key = s.brand;
      if (!groups[key]) groups[key] = { store: key, scores: [], byTemplate: {} };
      groups[key].scores.push(s.score);
      if (!groups[key].byTemplate[s.template_id]) {
        groups[key].byTemplate[s.template_id] = { title: s.template_title, scores: [] };
      }
      groups[key].byTemplate[s.template_id].scores.push(s.score);
    });
    return Object.values(groups)
      .map(g => {
        const avg = g.scores.reduce((a, b) => a + b, 0) / g.scores.length;
        // trend: compare latest half vs earlier half
        const sorted = [...g.scores];
        const mid = Math.floor(sorted.length / 2);
        const early = sorted.slice(0, mid);
        const late = sorted.slice(mid);
        const earlyAvg = early.length ? early.reduce((a, b) => a + b, 0) / early.length : avg;
        const lateAvg = late.length ? late.reduce((a, b) => a + b, 0) / late.length : avg;
        const trend = lateAvg - earlyAvg;
        const templateScores = Object.values(g.byTemplate).map(t => ({
          title: t.title,
          avg: t.scores.reduce((a, b) => a + b, 0) / t.scores.length,
        }));
        return { store: g.store, avg, trend, count: g.scores.length, templateScores, isPassing: avg >= PASS_THRESHOLD };
      })
      .sort((a, b) => b.avg - a.avg);
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
      const month = moment(s.submission_date || s.created_date).utcOffset(8).format('MMM YYYY');
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
          `${r.avg.toFixed(1)}%`,
          r.trend > 1 ? `+${r.trend.toFixed(1)}` : r.trend < -1 ? r.trend.toFixed(1) : '—',
          r.count,
          r.isPassing ? 'PASS' : 'FAIL',
        ]),
      },
    ];
    exportSheetsToExcel('Audit_Dashboard_Store_Performance', sheets);
  };

  const COLORS = ['#1fd655', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1fd655] flex items-center justify-center shadow-md">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Dashboard</h1>
            <p className="text-sm text-slate-500">Store quality performance summary</p>
          </div>
        </div>
        <ExcelExportButton onClick={handleExportExcel} disabled={filtered.length === 0} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
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

        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
          <span className="text-slate-400 text-sm">–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
        </div>
      </div>

      {isLoading ? (
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Overall Avg Score', value: `${stats.avg.toFixed(1)}%`, color: stats.avg >= PASS_THRESHOLD ? 'text-green-600' : 'text-red-600' },
              { label: 'Total Audits', value: stats.total, color: 'text-slate-900' },
              { label: 'Passing', value: stats.passing, color: 'text-green-600' },
              { label: 'Failing', value: stats.failing, color: 'text-red-600' },
            ].map(k => (
              <Card key={k.label} className="border border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className={`text-3xl font-extrabold ${k.color}`}>{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

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

          {/* Per-store Bar Chart */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><Store className="w-4 h-4 text-[#1fd655]" /> Average Score by Store</p>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              <ResponsiveContainer width="100%" height={Math.max(220, storeRows.length * 36)}>
                <BarChart data={storeRows.map(r => ({ name: r.store, score: parseFloat(r.avg.toFixed(1)), isPassing: r.isPassing }))}
                  layout="vertical" margin={{ left: 8, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: v => `${v}%` }}>
                    {storeRows.map((r, i) => (
                      <Cell key={i} fill={r.isPassing ? '#1fd655' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

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
                          <Badge className={r.isPassing ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
                            {r.isPassing ? 'PASS' : 'FAIL'}
                          </Badge>
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