import React, { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, TrendingUp, TrendingDown, Minus, ClipboardCheck, AlertTriangle, CalendarDays, Ticket, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import moment from 'moment';
import NoAnswerTracker from '@/components/audit/NoAnswerTracker';
import TemplateMultiSelect from '@/components/audit/TemplateMultiSelect';
import ChecklistCompletionCard from '@/components/audit/ChecklistCompletionCard';
import SubmissionDetail from '@/components/audit/SubmissionDetail';
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';
import { auditBusinessDayKey, formatPHDateTime } from '@/lib/dateUtils';
import { formatScore, answerCounts, isPassFailGraded } from '@/lib/auditScore';
import { isQaConductedTemplate } from '@/lib/checklistCategories';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';

const PASS_THRESHOLD = 75;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

// QA-conducted audits stay hidden from store users until QA results are
// cleared to be shared with stores — flip to false then, and store users
// will also see the QA audits done on their own stores.
const HIDE_QA_AUDITS_FROM_STORES = true;

// A template's store scoping: its store_restrictions list, or the single
// store_name/brand_id/store_id fields older templates still use.
function templateRestrictions(t) {
  if (t.store_restrictions?.length > 0) return t.store_restrictions;
  return t.store_name ? [{ store_name: t.store_name, brand_id: t.brand_id, store_id: t.store_id }] : [];
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
      {formatScore(score)}
    </span>
  );
}

function TrendIcon({ trend }) {
  if (trend > 1) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend < -1) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

// A NO item can recur dozens of times over a date range — showing every
// occurrence inline blows up the row height, so collapse it to a count with
// a click-to-expand panel listing them all.
function DateOccurrencesBadge({ labels }) {
  const [open, setOpen] = useState(false);
  if (!labels?.length) return <span className="text-slate-400">—</span>;
  if (labels.length === 1) return <span className="whitespace-nowrap">{labels[0]}</span>;

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 whitespace-nowrap"
      >
        {labels.length} dates
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-600 shadow-lg">
          {labels.map((label, i) => (
            <div key={i} className="whitespace-nowrap">{label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AuditDashboard() {
  const [user, setUser] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [selectedStoreId, setSelectedStoreId] = useState('all');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]); // [] = all templates
  const [dateFrom, setDateFrom] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const submissionDetailRef = useRef(null);
  const [exportingSubmissionPdf, setExportingSubmissionPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.user_type === 'admin';

  // Store users — a store manager across their assigned stores, or a store
  // account for its one store — only ever see their own stores;
  // admins/directors/QA see everything.
  const allowedStores = useMemo(() => {
    if (!user) return null;
    if (user.user_type === 'admin' || user.user_type === 'director') return null;
    if (user.user_type === 'store_manager') {
      return Array.isArray(user.assigned_stores) ? user.assigned_stores : [];
    }
    if (user.store_name) return [user.store_name];
    return null; // null = no restriction
  }, [user]);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-active'],
    queryFn: () => base44.entities.Store.filter({ is_active: true, kind: 'store' }, 'store_name', 500),
  });

  // One fetch for every template — inactive ones included, to resolve
  // historical answer IDs in the NO analysis and NO Answer Tracker. The
  // template filter only offers active ones, derived from the same list
  // instead of fetching again.
  const { data: templateDefinitions = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['audit-template-definitions-no-analysis'],
    queryFn: () => base44.entities.AuditTemplate.list('title', 500),
  });
  const templates = useMemo(() => templateDefinitions.filter(t => t.is_active === true), [templateDefinitions]);

  // Checklists that aren't graded pass/fail (pass mark 0, e.g. the Mayon
  // Daily Walkthrough) — their PASS/FAIL shows N/A wherever it's per
  // checklist, audit, or a store that only has those.
  const ungradedTemplateIds = useMemo(
    () => new Set(templateDefinitions.filter(t => !isPassFailGraded(t)).map(t => t.id)),
    [templateDefinitions]
  );
  const ungradedTemplateTitles = useMemo(
    () => new Set(templateDefinitions.filter(t => ungradedTemplateIds.has(t.id)).map(t => t.title)),
    [templateDefinitions, ungradedTemplateIds]
  );

  // The checklists a store user's own stores use — inactive ones too, so
  // older history still counts. QA-conducted checklists stay out while
  // HIDE_QA_AUDITS_FROM_STORES is on; with it off, QA audits show up too
  // (the database already limits every row to the user's own stores).
  const storeTemplateIds = useMemo(() => {
    if (!allowedStores) return null;
    const ownStores = new Set(allowedStores.map(name => String(name).trim().toLowerCase()));
    return new Set(templateDefinitions
      .filter(t => (isQaConductedTemplate(t)
        ? !HIDE_QA_AUDITS_FROM_STORES
        : templateRestrictions(t).some(r => ownStores.has(String(r.store_name || '').trim().toLowerCase()))))
      .map(t => t.id));
  }, [allowedStores, templateDefinitions]);

  // A store user's data is always narrowed to those checklists, which is
  // also what keeps QA audits out of every number on the page — so their
  // queries wait for the template list instead of ever running unscoped.
  // An empty list would mean "no filter" to the database, so a store with
  // no checklists skips the queries instead.
  const queryTemplateIds = selectedTemplateIds.length
    ? selectedTemplateIds
    : storeTemplateIds ? [...storeTemplateIds] : null;
  const queryTemplateKey = queryTemplateIds ? queryTemplateIds.join(',') : 'all';
  const noStoreChecklists = queryTemplateIds?.length === 0;
  const scopeReady = !!user && (!allowedStores || !loadingTemplates);
  const storesKey = allowedStores ? allowedStores.join(',') : 'all';

  // The summary query below returns quickly, so the page renders before this
  // (much larger) list arrives — everything built from it (Checklist
  // Completion, Recent Audits, the NO item analysis, NO Answer Tracker)
  // shows a spinner until then instead of a misleading empty/0 state.
  // isPending stays true for every new date range/template filter too,
  // since each one is a fresh query with no data yet.
  const { data: submissions = [], isPending: loadingSubmissions } = useQuery({
    queryKey: ['audit-submissions-dashboard', dateFrom, dateTo, queryTemplateKey, storesKey],
    queryFn: () => (noStoreChecklists ? [] : base44.audit.listSubmissions({
      dateFrom,
      dateTo,
      stores: allowedStores,
      templateIds: queryTemplateIds,
      maxRows: 25000,
      fields: 'summaryWithAnswers',
    })),
    enabled: scopeReady,
  });

  // Resolved name strings (not ids) for the summary RPC's brand/store
  // narrowing — matches the same brand.startsWith/store.includes semantics
  // `filtered` below uses for the raw-row views.
  const brandNameFilter = selectedBrandId === 'all' ? null : (brands.find(b => b.id === selectedBrandId)?.brand_name || null);
  const storeNameFilter = selectedStoreId === 'all' ? null : (stores.find(s => s.id === selectedStoreId)?.store_name || null);

  // Core dashboard numbers (stats, per-template, per-day, per-month,
  // per-store), computed server-side via GROUP BY instead of fetching every
  // raw submission to the browser — see audit_dashboard_summary migration.
  // allowedStores (store-manager scoping) doesn't need to be passed through:
  // private.can_access_audit already restricts the underlying rows to what
  // this user can see, the same way it does for the raw `submissions` fetch.
  const { data: dashboardSummary, isPending: loadingSummary, isError: summaryError, error: summaryErrorDetail, refetch: refetchSummary } = useQuery({
    queryKey: ['audit-dashboard-summary', dateFrom, dateTo, brandNameFilter, storeNameFilter, queryTemplateKey, storesKey],
    queryFn: () => (noStoreChecklists ? null : base44.audit.dashboardSummary({
      dateFrom,
      dateTo,
      brandName: brandNameFilter,
      storeName: storeNameFilter,
      templateIds: queryTemplateIds,
    })),
    enabled: scopeReady,
    // A timeout is often just a cold cache on the first hit for a given
    // set of filters — retrying (react-query's default) lets a borderline
    // query succeed on a warmed second attempt instead of failing outright.
    retry: 2,
  });


  // Global checklist completion config (admin-controlled, shared across all store users)
  const { data: configRecords = [] } = useQuery({
    queryKey: ['checklist-completion-config'],
    queryFn: () => base44.entities.ChecklistConfig.filter({ config_key: 'default' }, '-updated_date', 10),
  });
  const configRecord = configRecords[0];

  // Exclude QA audit templates (unrestricted) — only store-restricted checklists count toward completion
  const completionTemplates = useMemo(() => {
    return templates.filter(t => !t.requires_audit_type && (t.store_restrictions?.length > 0 || t.store_name));
  }, [templates]);

  // Determine selected IDs: admin config if set, otherwise default to all store-restricted templates
  const selectedIds = useMemo(() => {
    if (configRecord?.selected_template_ids) return configRecord.selected_template_ids;
    return completionTemplates.map(t => t.id);
  }, [configRecord, completionTemplates]);

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

  // This user's own store records — used to resolve their assigned store
  // names to actual brand_id/store_id links instead of guessing via
  // substring matches on the name.
  const ownStoreRecords = useMemo(() => {
    if (!allowedStores) return stores;
    return stores.filter(s => allowedStores.includes(s.store_name));
  }, [stores, allowedStores]);

  // Brands visible to this user (store users only see brands tied to their own stores)
  const visibleBrands = useMemo(() => {
    if (!allowedStores) return brands;
    const ownBrandIds = new Set(ownStoreRecords.map(s => s.brand_id));
    return brands.filter(b => ownBrandIds.has(b.id));
  }, [brands, allowedStores, ownStoreRecords]);

  // Stores visible under the current brand selection (store users stay
  // scoped to their own stores regardless of brand).
  const visibleStores = useMemo(() => {
    const base = allowedStores ? ownStoreRecords : stores;
    if (selectedBrandId === 'all') return base;
    return base.filter(s => s.brand_id === selectedBrandId);
  }, [stores, ownStoreRecords, allowedStores, selectedBrandId]);

  // Store records (not just names) for the Checklist Completion Rate card —
  // it needs to track completion per store, not just an allowlist.
  const checklistCompletionStores = useMemo(() => {
    if (selectedStoreId !== 'all') {
      const store = stores.find(s => s.id === selectedStoreId);
      return store ? [store] : [];
    }
    if (selectedBrandId !== 'all') return visibleStores;
    return allowedStores ? ownStoreRecords : stores;
  }, [selectedBrandId, selectedStoreId, stores, visibleStores, allowedStores, ownStoreRecords]);

  // Templates scoped to the current brand/store selection, for the filter
  // dropdown — for a store user, only their own stores' checklists.
  // Unrestricted (QA-wide) templates have no store_restrictions and no
  // store_name, so they always stay visible under "All Brands" but don't
  // mix into a specific brand's own template list.
  const filterTemplates = useMemo(() => {
    return templates.filter(t => {
      if (storeTemplateIds && !storeTemplateIds.has(t.id)) return false;
      const restrictions = templateRestrictions(t);
      if (selectedStoreId !== 'all') {
        return restrictions.some(r => r.store_id === selectedStoreId) || t.store_id === selectedStoreId;
      }
      if (selectedBrandId !== 'all') {
        return restrictions.some(r => r.brand_id === selectedBrandId) || t.brand_id === selectedBrandId;
      }
      return true;
    });
  }, [templates, selectedBrandId, selectedStoreId, storeTemplateIds]);

  // Store-restricted templates scoped to the current brand/store selection —
  // what the Checklist Completion Rate card should actually count as "N
  // required daily" for the page you're looking at, instead of the raw
  // site-wide total. Templates required for other brands/stores don't
  // apply here, so they're excluded rather than counted in.
  const scopedCompletionTemplates = useMemo(() => {
    if (selectedTemplateIds.length) return completionTemplates.filter(t => selectedTemplateIds.includes(t.id));
    return completionTemplates.filter(t => {
      if (storeTemplateIds && !storeTemplateIds.has(t.id)) return false;
      const restrictions = templateRestrictions(t);
      if (selectedStoreId !== 'all') {
        return restrictions.some(r => r.store_id === selectedStoreId) || t.store_id === selectedStoreId;
      }
      if (selectedBrandId !== 'all') {
        return restrictions.some(r => r.brand_id === selectedBrandId) || t.brand_id === selectedBrandId;
      }
      return true;
    });
  }, [completionTemplates, selectedBrandId, selectedStoreId, selectedTemplateIds, storeTemplateIds]);

  useEffect(() => { setSelectedStoreId('all'); }, [selectedBrandId]);
  useEffect(() => { setSelectedTemplateIds([]); }, [selectedBrandId, selectedStoreId]);

  // Filter submissions
  const filtered = useMemo(() => {
    let subs = submissions.filter(s => s.score != null);
    // Scope store users to their own stores
    if (allowedStores) {
      subs = subs.filter(s => allowedStores.some(name => s.brand?.includes(name)));
    }
    if (selectedBrandId !== 'all') {
      const brand = brands.find(b => b.id === selectedBrandId);
      if (brand) subs = subs.filter(s => s.brand && s.brand.startsWith(brand.brand_name));
    }
    if (selectedStoreId !== 'all') {
      const store = stores.find(s => s.id === selectedStoreId);
      if (store) subs = subs.filter(s => s.brand?.includes(store.store_name));
    }
    if (selectedTemplateIds.length) {
      subs = subs.filter(s => selectedTemplateIds.includes(s.template_id));
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
  }, [submissions, brands, stores, allowedStores, selectedBrandId, selectedStoreId, selectedTemplateIds, dateFrom, dateTo]);


  useEffect(() => { setPage(1); }, [filtered.length, pageSize, selectedBrandId, selectedStoreId, selectedTemplateIds, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedSubmissions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return [...filtered]
      .sort((a, b) => new Date(b.submission_date || b.created_date) - new Date(a.submission_date || a.created_date))
      .slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Performance for every audit template represented by the current
  // filters — computed server-side (see audit_dashboard_summary) instead of
  // reduced from every raw submission in the browser. Deliberately includes
  // OD checklists so the template analysis is complete, same as before.
  const templateRows = dashboardSummary?.templateRows || [];

  const noTemplateRows = useMemo(
    () => [...templateRows].sort((a, b) => b.noFindings - a.noFindings || b.tickets - a.tickets || a.title.localeCompare(b.title)),
    [templateRows]
  );

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
  }, [filtered, auditItemLookup]);

  const topNoItem = noItemRows[0] || null;
  const topNoItemChartRows = noItemRows.slice(0, 15);

  // Per-day rows arrive pre-aggregated from the summary RPC; just attach
  // the display label the chart/table expect.
  const dailyRows = useMemo(
    () => (dashboardSummary?.dailyRows || []).map(row => ({
      ...row,
      label: moment(row.day, 'YYYY-MM-DD').format('MMM D'),
    })),
    [dashboardSummary]
  );

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


  // Summary stats — computed server-side (see audit_dashboard_summary) so a
  // whole month across every brand doesn't require fetching every raw
  // submission just to average/count them in the browser.
  const stats = useMemo(() => {
    const s = dashboardSummary?.stats;
    if (!s || !s.total) return null;
    return {
      avg: Number(s.avg) || 0,
      passing: s.passing,
      failing: s.failing,
      total: s.total,
      stores: s.stores,
    };
  }, [dashboardSummary]);

  // Per-store summary table — same server-side source; trend is the same
  // early-half-vs-late-half comparison as before, just computed via a SQL
  // window function instead of array slicing in JS.
  const storeRows = useMemo(
    () => (dashboardSummary?.storeRows || []).map(row => {
      const templateScores = (row.templateScores || []).map(t => ({ title: t.title, avg: Number(t.avg) }));
      const notGraded = templateScores.length > 0 && templateScores.every(t => ungradedTemplateTitles.has(t.title));
      return {
        ...row,
        avg: row.avg != null ? Number(row.avg) : null,
        trend: Number(row.trend) || 0,
        templateScores,
        notGraded,
        isPassing: notGraded ? null : row.isPassing,
      };
    }),
    [dashboardSummary, ungradedTemplateTitles]
  );

  const noItemPagination = usePagination(noItemRows);
  const storePagination = usePagination(storeRows);

  // All unique template titles visible in current filter
  const visibleTemplates = useMemo(() => {
    const seen = new Set();
    const out = [];
    storeRows.forEach(r => r.templateScores.forEach(t => {
      if (!seen.has(t.title)) { seen.add(t.title); out.push(t.title); }
    }));
    return out;
  }, [storeRows]);

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
          r.notGraded ? 'N/A' : r.isPassing == null ? '—' : (r.isPassing ? 'PASS' : 'FAIL'),
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
          ungradedTemplateIds.has(row.id) ? 'N/A' : row.passing,
          ungradedTemplateIds.has(row.id) ? 'N/A' : row.failing,
          ungradedTemplateIds.has(row.id) ? 'N/A' : `${row.passRate.toFixed(1)}%`,
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

        <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {visibleStores.map(s => <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <TemplateMultiSelect
          templates={filterTemplates}
          selected={selectedTemplateIds}
          onChange={setSelectedTemplateIds}
          disabled={loadingTemplates}
          placeholder={loadingTemplates ? 'Loading templates…' : 'All Templates'}
        />

        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
          <span className="hidden text-sm text-slate-400 sm:inline">–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
        </div>
      </div>

      {loadingSummary ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : summaryError ? (
        <Card className="border-2 border-dashed border-red-200">
          <CardContent className="py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-red-600 font-semibold">Couldn't load the dashboard for this range.</p>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              {summaryErrorDetail?.message?.includes('statement timeout') || summaryErrorDetail?.code === '57014'
                ? 'The query timed out — try a shorter date range, fewer templates, or a specific brand/store.'
                : (summaryErrorDetail?.message || 'An unexpected error occurred.')}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetchSummary()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !stats ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No audit submissions found for the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Overall Avg Score', value: stats.avg != null ? `${stats.avg.toFixed(1)}%` : '—', color: stats.avg != null && stats.avg >= PASS_THRESHOLD ? 'text-green-600' : 'text-red-600' },
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

          {/* NO findings headline analytics */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                {loadingSubmissions ? (
                  <Loader2 className="mt-3 h-6 w-6 animate-spin text-orange-400" />
                ) : (
                  <>
                    <p className="mt-2 line-clamp-2 text-lg font-bold text-slate-900">{topNoItem?.label || 'No NO findings'}</p>
                    <p className="mt-1 text-sm text-slate-600">{topNoItem ? `${topNoItem.count} NO · ${topNoItem.storeCount} affected store${topNoItem.storeCount !== 1 ? 's' : ''}` : '—'}</p>
                  </>
                )}
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
            templates={scopedCompletionTemplates}
            submissions={filtered}
            dateFrom={dateFrom}
            dateTo={dateTo}
            isAdmin={isAdmin}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
            saving={saving}
            stores={checklistCompletionStores}
            loading={loadingSubmissions}
          />

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
                    {ungradedTemplateIds.has(row.id) ? (
                      <td colSpan={3} className="px-4 py-3 text-center text-slate-400">N/A — not graded pass/fail</td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-center text-green-600">{row.passing}</td>
                        <td className="px-4 py-3 text-center text-red-600">{row.failing}</td>
                        <td className="px-4 py-3 text-center">{row.passRate.toFixed(1)}%</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-center text-amber-600">{row.noFindings}</td>
                    <td className="px-4 py-3 text-center font-semibold text-violet-600">{row.tickets}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Audits — individual submissions, clickable to view the full checklist and export a PDF */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <p className="font-bold text-slate-800">Recent Audits</p>
                {!loadingSubmissions && <p className="text-xs text-slate-400">{filtered.length} total</p>}
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
                    {loadingSubmissions ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-10"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></td>
                      </tr>
                    ) : pagedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center px-5 py-10 text-slate-400 text-sm">No audits in the selected date range.</td>
                      </tr>
                    ) : pagedSubmissions.map((s, i) => {
                      const counts = answerCounts(s);
                      return (
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
                            <CheckCircle2 className="w-3.5 h-3.5" />{counts.yes}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className="flex items-center justify-center gap-1 text-red-500 font-semibold text-xs">
                            <XCircle className="w-3.5 h-3.5" />{counts.no}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3 text-slate-400 text-xs">{counts.na}</td>
                        <td className="text-center px-3 py-3">
                          {ungradedTemplateIds.has(s.template_id) ? (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">N/A</Badge>
                          ) : (
                            <Badge className={s.score >= PASS_THRESHOLD ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
                              {s.score >= PASS_THRESHOLD ? 'PASS' : 'FAIL'}
                            </Badge>
                          )}
                        </td>
                        <td className="text-right px-5 py-3 text-slate-500 text-xs">{formatPHDateTime(s.submission_date || s.created_date)}</td>
                      </tr>
                      );
                    })}
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

          {/* Individual checklist-item NO analysis */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Top NO Findings by Checklist Item</p>
              <p className="text-xs text-slate-500">Examples include MIS — POS, CCTV, BMD — Pizza Oven, Sales Performance, and Manager Daily Focus. The chart shows the top 15; the complete ranked list and every affected store appear below.</p>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              {loadingSubmissions ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
              ) : topNoItemChartRows.length ? (
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
                <table className="w-full min-w-[1150px] text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {['Rank', 'Date', 'Area / Section', 'Checklist Item', 'Template', 'Total NO', 'Stores', 'Store Breakdown'].map(header => (
                      <th key={header} className={`${['Area / Section', 'Checklist Item', 'Template', 'Store Breakdown'].includes(header) ? 'text-left' : 'text-center'} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600`}>{header}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loadingSubmissions && (
                      <tr><td colSpan={8} className="px-4 py-12"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></td></tr>
                    )}
                    {!loadingSubmissions && noItemPagination.pageItems.map((row, index) => (
                      <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-4 py-3 text-center font-semibold text-slate-500">{noItemPagination.startIndex + index + 1}</td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          <DateOccurrencesBadge labels={row.dateLabels} />
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.section}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{row.item}</td>
                        <td className="max-w-[240px] px-4 py-3 text-slate-600">{row.templateSummary}</td>
                        <td className="px-4 py-3 text-center text-lg font-extrabold text-red-600">{row.count}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.storeCount}</td>
                        <td className="min-w-[320px] px-4 py-3 leading-6 text-slate-600">{row.storeSummary}</td>
                      </tr>
                    ))}
                    {!loadingSubmissions && !noItemRows.length && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No checklist items were marked NO for the selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination page={noItemPagination.page} totalPages={noItemPagination.totalPages} onPageChange={noItemPagination.setPage} className="px-5 pt-4" />
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
                    {storePagination.pageItems.map((r, i) => (
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
  {r.notGraded ? (
    <Badge className="bg-slate-100 text-slate-600 border-slate-200">N/A</Badge>
  ) : r.isPassing == null ? (
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
              <TablePagination page={storePagination.page} totalPages={storePagination.totalPages} onPageChange={storePagination.setPage} className="px-5 pt-4" />
            </CardContent>
          </Card>

          {/* NO Answer Tracker */}
          <NoAnswerTracker submissions={filtered} templates={templateDefinitions} dateFrom={dateFrom} dateTo={dateTo} loading={loadingSubmissions} />
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
                templates={templates}
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
