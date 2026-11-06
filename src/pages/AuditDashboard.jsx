import React, { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { useToast } from '@/components/ui/use-toast';
import Spinner from '@/components/Spinner';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, TrendingUp, TrendingDown, Minus, ClipboardCheck, AlertTriangle, CalendarDays, Ticket, CheckCircle2, XCircle, ChevronLeft, ChevronRight, ChevronDown, FileText, ListOrdered, Store } from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import moment from 'moment';
import NoAnswerTracker from '@/components/audit/NoAnswerTracker';
import TemplateMultiSelect from '@/components/audit/TemplateMultiSelect';
import ChecklistCompletionCard from '@/components/audit/ChecklistCompletionCard';
import NoFindingsByTemplateCard from '@/components/audit/NoFindingsByTemplateCard';
import NoFindingsByCategoryCard from '@/components/audit/NoFindingsByCategoryCard';
import SubmissionDetail from '@/components/audit/SubmissionDetail';
import QaAuditsPanel, { buildQaAuditRows } from '@/components/audit/QaAuditsPanel';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';
import { exportSheetsToXlsx } from '@/lib/exportXlsx';
import { auditBusinessDayKey, formatPHDateTime } from '@/lib/dateUtils';
import { formatScore, answerCounts, isPassFailGraded, STORE_PASS_THRESHOLD } from '@/lib/auditScore';
import { isQaConductedTemplate, normalizeChecklistCategory, QA_AUDITS_VISIBLE_TO_STORES } from '@/lib/checklistCategories';
import { computeCompletion, completionCellState, completionRateScale, brandSeriesColor, roundRate, COMPLETION_TARGET } from '@/lib/checklistCompletion';
import { OWNERSHIP_OPTIONS, storeOwnership, labelOwnership, ownershipLabel } from '@/lib/storeOwnership';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
// The most checklists the Store Checklists tab loads with every answer for
// one range, for the reports. Completion arrives grouped by the database;
// only its fallback for a database without that function lists checklists,
// up to MAX_COMPLETION_ROWS.
const MAX_SUBMISSION_ROWS = 25000;
const MAX_COMPLETION_ROWS = 40000;
const NO_ROWS = [];

// Reports that read every answer of every checklist in range — they share
// one heavy fetch, made only once one of them is opened.
const ANSWER_REPORTS = new Set(['recent', 'noItems', 'noSummary', 'noTracker']);

const todayInManila = () => moment().utcOffset(8).format('YYYY-MM-DD');
// A full date a person meant — not the year 0002 a date box briefly holds
// while 2026 is typed into it.
const isRealDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= '2020-01-01' && day <= '2100-12-31';

// QA checklists for facilities, never for a store's own results.
const FACILITY_CATEGORIES = new Set(['commissary', 'warehouse', 'mayon']);

// A template's store scoping: its store_restrictions list, or the single
// store_name/brand_id/store_id fields older templates still use.
function templateRestrictions(t) {
  if (t.store_restrictions?.length > 0) return t.store_restrictions;
  return t.store_name ? [{ store_name: t.store_name, brand_id: t.brand_id, store_id: t.store_id }] : [];
}

// Ownership / brand / store / checklist / business-day filters, shared by
// both tabs.
function filterDashboardRows(rows, { allowedStores, ownership, ownershipOf, brand, store, templateIds, dateFrom, dateTo }) {
  return rows.filter(s => {
    if (s.score == null) return false;
    // Store users stay on their own stores
    if (allowedStores && !allowedStores.some(name => s.brand?.includes(name))) return false;
    // The Corporate / Franchise tab
    if (ownership && ownershipOf(s.brand) !== ownership) return false;
    if (brand && !s.brand?.startsWith(brand.brand_name)) return false;
    if (store && !s.brand?.includes(store.store_name)) return false;
    if (templateIds.length && !templateIds.includes(s.template_id)) return false;
    const day = auditBusinessDayKey(s);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });
}

// Green at the store pass mark; amber for a near miss (within 10 points).
function ScoreBadge({ score }) {
  if (score == null) return <span className="text-slate-300 text-sm">—</span>;
  const cls = score >= STORE_PASS_THRESHOLD
    ? 'bg-green-100 text-green-700 border-green-200'
    : score >= STORE_PASS_THRESHOLD - 10
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

// Rank every individual checklist item marked NO. Identically named items
// in the same section are combined across templates, while the contributing
// templates and exact stores remain visible in the detail columns.
function buildNoItemRows(rows, itemLookup) {
  const groups = new Map();

  rows.forEach(submission => {
    Object.entries(submission.answers || {}).forEach(([itemId, answer]) => {
      if (String(answer || '').trim().toUpperCase() !== 'NO') return;

      const definition = itemLookup.get(`${submission.template_id}::${itemId}`) || {
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
}

// One report on the Store Checklists tab, collapsed until opened. Its
// content only renders — and data only it needs only loads — once it's
// open, so the page starts with just the headline numbers.
function ReportSection({ id, title, icon, description, open, onToggle, children }) {
  const contentId = `report-${id}`;
  return (
    <Card className="border border-slate-200 shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition-colors hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-bold text-slate-800">{icon}{title}</span>
          {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div id={contentId}>{children}</div>}
    </Card>
  );
}

export default function AuditDashboard() {
  const [user, setUser] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [selectedStoreId, setSelectedStoreId] = useState('all');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]); // [] = all templates
  // Store checklists and QA audits are graded differently (95% vs each QA
  // checklist's own pass mark) and come at very different volumes, so they
  // never share numbers — each gets its own tab.
  const [dashboardTab, setDashboardTab] = useState('store'); // 'store' | 'qa'
  // Corporate and franchise stores are reported separately.
  const [ownership, setOwnership] = useState('corporate'); // 'corporate' | 'franchise'
  // The range the page shows, and what the date boxes hold — the boxes
  // apply half a second after the last change, once they form a real
  // range, so picking or typing dates doesn't fire a fetch per keystroke.
  const [dateFrom, setDateFrom] = useState(todayInManila);
  const [dateTo, setDateTo] = useState(todayInManila);
  const [dateFromInput, setDateFromInput] = useState(todayInManila);
  const [dateToInput, setDateToInput] = useState(todayInManila);
  // Which collapsible reports are open; and the filters someone asked the
  // Top NO checklist item tile to load for.
  const [openReports, setOpenReports] = useState(() => new Set());
  const [answersRequestedFor, setAnswersRequestedFor] = useState(null);
  const [preparingExport, setPreparingExport] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
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
  // Store users only ever see their own stores, so they get no
  // Corporate / Franchise choice — everyone else sees one at a time (once
  // it's known who's signed in, so a store user never sees the tabs flash).
  const ownershipFilter = user && !allowedStores ? ownership : null;

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-active'],
    queryFn: () => base44.entities.Store.filter({ is_active: true, kind: 'store' }, 'store_name', 2000),
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

  const templateDefinitionsById = useMemo(
    () => Object.fromEntries(templateDefinitions.map(t => [t.id, t])),
    [templateDefinitions]
  );

  // Which checklists belong to which tab — inactive ones too, so older
  // history still counts. A store user gets only their own stores'
  // checklists, plus (once QA_AUDITS_VISIBLE_TO_STORES) the QA checklists
  // done at stores: one scoped to their stores, or a general one with no
  // store scoping — never a facility or department checklist. The database
  // still limits every row to their own stores.
  const { storeChecklistIds, qaChecklistIds } = useMemo(() => {
    const ownStores = allowedStores && new Set(allowedStores.map(name => String(name).trim().toLowerCase()));
    const isForOwnStore = (t) => templateRestrictions(t).some(r => ownStores.has(String(r.store_name || '').trim().toLowerCase()));
    const storeIds = new Set();
    const qaIds = new Set();
    templateDefinitions.forEach(t => {
      if (!isQaConductedTemplate(t)) {
        if (!ownStores || isForOwnStore(t)) storeIds.add(t.id);
      } else if (!ownStores) {
        qaIds.add(t.id);
      } else if (QA_AUDITS_VISIBLE_TO_STORES && (isForOwnStore(t) || (
        templateRestrictions(t).length === 0
        && !t.requires_department
        && !FACILITY_CATEGORIES.has(normalizeChecklistCategory(t.checklist_category))
      ))) {
        qaIds.add(t.id);
      }
    });
    return { storeChecklistIds: storeIds, qaChecklistIds: qaIds };
  }, [allowedStores, templateDefinitions]);
  const showQaTab = !allowedStores || QA_AUDITS_VISIBLE_TO_STORES;

  // The Store Checklists tab's queries are always narrowed to store
  // checklists — that's what keeps QA audits out of its numbers — so they
  // wait for the template list instead of ever running unscoped. An empty
  // list would mean "no filter" to the database, so a user with no store
  // checklists skips the queries instead.
  const queryTemplateIds = selectedTemplateIds.length && dashboardTab === 'store'
    ? selectedTemplateIds
    : [...storeChecklistIds];
  const queryTemplateKey = queryTemplateIds.join(',');
  const noStoreChecklists = queryTemplateIds.length === 0;
  const scopeReady = !!user && !loadingTemplates;
  const storeTabReady = scopeReady && dashboardTab === 'store';
  const storesKey = allowedStores ? allowedStores.join(',') : 'all';

  // Every answer of every checklist in range — by far the heaviest load on
  // the page, so it's only fetched once a report that reads it is opened
  // (or the Top NO checklist item tile is asked to load). Everything else
  // comes from the summary and the light completion list below. The export
  // fetches it through the same options when it needs it.
  const answersQuery = {
    queryKey: ['audit-submissions-dashboard', dateFrom, dateTo, queryTemplateKey, storesKey],
    queryFn: ({ signal }) => (noStoreChecklists ? { rows: [], truncated: false } : base44.audit.listSubmissions({
      dateFrom,
      dateTo,
      stores: allowedStores,
      templateIds: queryTemplateIds,
      maxRows: MAX_SUBMISSION_ROWS,
      fields: 'summaryWithAnswers',
      withMeta: true,
      signal,
    })),
  };
  const answersKey = answersQuery.queryKey.join('|');
  const wantsAnswers = [...openReports].some(id => ANSWER_REPORTS.has(id)) || answersRequestedFor === answersKey;
  const { data: answersResult, isPending: answersPending } = useQuery({
    ...answersQuery,
    enabled: storeTabReady && wantsAnswers,
  });
  // Not asked for yet is "pending" too — only that counts as loading.
  const loadingAnswers = storeTabReady && wantsAnswers && answersPending;
  const answerRows = answersResult?.rows ?? NO_ROWS;

  // QA Audits tab — only fetched once the tab is opened. QA audits are a
  // handful a day, so every QA checklist in range comes back in one go and
  // the checklist filter is applied in the browser.
  const qaTemplateList = useMemo(() => [...qaChecklistIds], [qaChecklistIds]);
  const { data: qaSubmissions = [], isPending: loadingQaSubmissions } = useQuery({
    queryKey: ['audit-dashboard-qa', dateFrom, dateTo, qaTemplateList.join(','), storesKey],
    queryFn: () => (qaTemplateList.length === 0 ? [] : base44.audit.listSubmissions({
      dateFrom,
      dateTo,
      stores: allowedStores,
      templateIds: qaTemplateList,
      maxRows: 5000,
      fields: 'summaryWithAnswers',
    })),
    enabled: scopeReady && dashboardTab === 'qa',
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
    queryKey: ['audit-dashboard-summary', dateFrom, dateTo, brandNameFilter, storeNameFilter, queryTemplateKey, storesKey, ownershipFilter],
    queryFn: () => (noStoreChecklists ? null : base44.audit.dashboardSummary({
      dateFrom,
      dateTo,
      brandName: brandNameFilter,
      storeName: storeNameFilter,
      templateIds: queryTemplateIds,
      ownership: ownershipFilter,
    })),
    enabled: storeTabReady,
    // A timeout is often just a cold cache on the first hit for a given
    // set of filters — retrying (react-query's default) lets a borderline
    // query succeed on a warmed second attempt instead of failing outright.
    retry: 2,
  });


  // Global checklist completion config (admin-controlled, shared across all store users)
  const { data: configRecords = [], isPending: loadingConfig } = useQuery({
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

  // Corporate or franchise for a submission's "Brand - Store" label.
  const ownershipOf = useMemo(() => labelOwnership(stores), [stores]);
  const ownershipCounts = useMemo(() => {
    const counts = { corporate: 0, franchise: 0 };
    stores.forEach(s => { counts[storeOwnership(s)] += 1; });
    return counts;
  }, [stores]);

  // The store records this page covers: a store user's own — resolved to
  // their actual brand_id/store_id links instead of guessing via substring
  // matches on the name — or everyone else's open Corporate / Franchise tab.
  const ownStoreRecords = useMemo(() => {
    if (!allowedStores) return stores.filter(s => storeOwnership(s) === ownershipFilter);
    return stores.filter(s => allowedStores.includes(s.store_name));
  }, [stores, allowedStores, ownershipFilter]);

  // Brands to pick from: a store user's own stores' brands. Otherwise the
  // open tab's — on Corporate, also a brand with no store records at all
  // (a facility), as before the split.
  const visibleBrands = useMemo(() => {
    const ownBrandIds = new Set(ownStoreRecords.map(s => s.brand_id));
    if (allowedStores) return brands.filter(b => ownBrandIds.has(b.id));
    const brandsWithStores = new Set(stores.map(s => s.brand_id));
    return brands.filter(b => ownBrandIds.has(b.id) || (ownershipFilter === 'corporate' && !brandsWithStores.has(b.id)));
  }, [brands, stores, allowedStores, ownStoreRecords, ownershipFilter]);

  // Stores visible under the current brand selection.
  const visibleStores = useMemo(() => {
    if (selectedBrandId === 'all') return ownStoreRecords;
    return ownStoreRecords.filter(s => s.brand_id === selectedBrandId);
  }, [ownStoreRecords, selectedBrandId]);

  // A brand with stores on the other tab too stays picked; a store is on
  // one tab only, so that resets.
  const changeOwnership = (value) => {
    setOwnership(value);
    setSelectedStoreId('all');
    if (selectedBrandId !== 'all' && !stores.some(s => s.brand_id === selectedBrandId && storeOwnership(s) === value)) {
      setSelectedBrandId('all');
    }
  };

  // Store records (not just names) for the Checklist Completion Rate card —
  // it needs to track completion per store, not just an allowlist.
  const checklistCompletionStores = useMemo(() => {
    if (selectedStoreId !== 'all') {
      const store = stores.find(s => s.id === selectedStoreId);
      return store ? [store] : [];
    }
    if (selectedBrandId !== 'all') return visibleStores;
    return ownStoreRecords;
  }, [selectedBrandId, selectedStoreId, stores, visibleStores, ownStoreRecords]);

  // Templates scoped to the current tab and brand/store selection, for the
  // filter dropdown. Unrestricted (QA-wide) templates have no
  // store_restrictions and no store_name, so they always stay visible under
  // "All Brands" but don't mix into a specific brand's own template list.
  const tabChecklistIds = dashboardTab === 'qa' ? qaChecklistIds : storeChecklistIds;
  const filterTemplates = useMemo(() => {
    return templates.filter(t => {
      if (!tabChecklistIds.has(t.id)) return false;
      const restrictions = templateRestrictions(t);
      if (selectedStoreId !== 'all') {
        return restrictions.some(r => r.store_id === selectedStoreId) || t.store_id === selectedStoreId;
      }
      if (selectedBrandId !== 'all') {
        return restrictions.some(r => r.brand_id === selectedBrandId) || t.brand_id === selectedBrandId;
      }
      return true;
    });
  }, [templates, selectedBrandId, selectedStoreId, tabChecklistIds]);

  // Store-restricted templates scoped to the current brand/store selection —
  // what the Checklist Completion Rate card should actually count as "N
  // required daily" for the page you're looking at, instead of the raw
  // site-wide total. Templates required for other brands/stores don't
  // apply here, so they're excluded rather than counted in.
  const scopedCompletionTemplates = useMemo(() => {
    if (selectedTemplateIds.length) return completionTemplates.filter(t => selectedTemplateIds.includes(t.id));
    return completionTemplates.filter(t => {
      if (!storeChecklistIds.has(t.id)) return false;
      const restrictions = templateRestrictions(t);
      if (selectedStoreId !== 'all') {
        return restrictions.some(r => r.store_id === selectedStoreId) || t.store_id === selectedStoreId;
      }
      if (selectedBrandId !== 'all') {
        return restrictions.some(r => r.brand_id === selectedBrandId) || t.brand_id === selectedBrandId;
      }
      return true;
    });
  }, [completionTemplates, selectedBrandId, selectedStoreId, selectedTemplateIds, storeChecklistIds]);

  const brandNameById = useMemo(() => new Map(brands.map(b => [b.id, b.brand_name])), [brands]);
  // Every store brand A–Z, whatever is filtered — it fixes each brand's
  // line color on the completion trend.
  const completionBrandNames = useMemo(
    () => [...new Set(stores.map(s => brandNameById.get(s.brand_id) || s.brand_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [stores, brandNameById]
  );

  // The checklists that count toward completion here, per the config.
  const activeCompletionTemplates = useMemo(
    () => scopedCompletionTemplates.filter(t => selectedIds.includes(t.id)),
    [scopedCompletionTemplates, selectedIds]
  );
  const completionTemplateIds = activeCompletionTemplates.map(t => t.id);

  // Which store did which of those checklists on which day, grouped by the
  // database — a small download however long the range, so the completion
  // section loads with the page. Both tabs share it; each counts its own
  // stores. (The database already limits a store user to their stores.)
  const { data: completionResult, isPending: completionPending } = useQuery({
    queryKey: ['audit-dashboard-completion', dateFrom, dateTo, completionTemplateIds.join(','), storesKey],
    queryFn: ({ signal }) => (completionTemplateIds.length === 0 ? { done: [], truncated: false } : base44.audit.completionDays({
      dateFrom,
      dateTo,
      templateIds: completionTemplateIds,
      maxRows: MAX_COMPLETION_ROWS,
      signal,
    })),
    enabled: storeTabReady && !loadingConfig,
  });
  // Until it's known who's signed in there's nothing to count yet — a
  // spinner, not a 0%.
  const loadingCompletion = !scopeReady || (storeTabReady && (loadingConfig || completionPending));
  // Only the fallback list can hit its row limit; then the earliest days
  // come back incomplete — completion would count their checklists as
  // missed, so it says so instead.
  const completionCapped = !!completionResult?.truncated;

  // Checklist completion per store per day — shared by the completion
  // section and the Excel export. Counted from every finalized submission
  // in range (not just scored ones).
  const completion = useMemo(() => computeCompletion({
    stores: checklistCompletionStores,
    templates: activeCompletionTemplates,
    done: completionResult?.done ?? null,
    submissions: completionResult?.submissions ?? NO_ROWS,
    dateFrom,
    dateTo,
    brandNameById,
  }), [checklistCompletionStores, activeCompletionTemplates, completionResult, dateFrom, dateTo, brandNameById]);

  useEffect(() => { setSelectedStoreId('all'); }, [selectedBrandId]);
  useEffect(() => { setSelectedTemplateIds([]); }, [selectedBrandId, selectedStoreId, dashboardTab]);

  const dateInputsValid = isRealDay(dateFromInput) && isRealDay(dateToInput) && dateFromInput <= dateToInput;
  useEffect(() => {
    if (!dateInputsValid || (dateFromInput === dateFrom && dateToInput === dateTo)) return undefined;
    const timer = setTimeout(() => {
      setDateFrom(dateFromInput);
      setDateTo(dateToInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [dateInputsValid, dateFromInput, dateToInput, dateFrom, dateTo]);

  const toggleReport = (id) => setOpenReports(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Filter submissions — the checklist selection belongs to whichever tab is open.
  const rowFilters = useMemo(() => ({
    allowedStores,
    ownership: ownershipFilter,
    ownershipOf,
    brand: selectedBrandId === 'all' ? null : brands.find(b => b.id === selectedBrandId),
    store: selectedStoreId === 'all' ? null : stores.find(s => s.id === selectedStoreId),
    templateIds: selectedTemplateIds,
    dateFrom,
    dateTo,
  }), [allowedStores, ownershipFilter, ownershipOf, brands, stores, selectedBrandId, selectedStoreId, selectedTemplateIds, dateFrom, dateTo]);
  const filtered = useMemo(
    () => filterDashboardRows(answerRows, dashboardTab === 'store' ? rowFilters : { ...rowFilters, templateIds: [] }),
    [answerRows, rowFilters, dashboardTab]
  );
  const qaFiltered = useMemo(
    () => filterDashboardRows(qaSubmissions, dashboardTab === 'qa' ? rowFilters : { ...rowFilters, templateIds: [] }),
    [qaSubmissions, rowFilters, dashboardTab]
  );


  useEffect(() => { setPage(1); }, [filtered.length, pageSize, ownershipFilter, selectedBrandId, selectedStoreId, selectedTemplateIds, dateFrom, dateTo]);

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

  // NO Findings by Category — one checklist at a time, picked from those
  // with NO findings in range (the one with the most to start with). Its
  // item counts come back with its id, so while another checklist loads the
  // previous chart stays up (dimmed) with its own sections.
  const categoryOptions = useMemo(() => noTemplateRows.filter(row => row.noFindings > 0), [noTemplateRows]);
  const [categoryTemplateId, setCategoryTemplateId] = useState(null);
  const categoryTemplateIdShown = (categoryOptions.find(row => row.id === categoryTemplateId) || categoryOptions[0])?.id || null;
  const { data: categoryResult, isPending: categoryPending, isPlaceholderData: categoryStale, error: categoryError } = useQuery({
    queryKey: ['audit-no-findings-by-item', categoryTemplateIdShown, dateFrom, dateTo, brandNameFilter, storeNameFilter, storesKey, ownershipFilter],
    queryFn: async ({ signal }) => ({
      templateId: categoryTemplateIdShown,
      items: await base44.audit.noFindingsByItem({
        templateId: categoryTemplateIdShown,
        dateFrom,
        dateTo,
        brandName: brandNameFilter,
        storeName: storeNameFilter,
        ownership: ownershipFilter,
        signal,
      }),
    }),
    enabled: storeTabReady && !!categoryTemplateIdShown,
    placeholderData: keepPreviousData,
    retry: (failures, error) => !error?.missingRpc && failures < 2,
  });

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

  const noItemRows = useMemo(() => buildNoItemRows(filtered, auditItemLookup), [filtered, auditItemLookup]);

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

  const brandLabel = selectedBrandId === 'all' ? 'All Brands' : (brands.find(b => b.id === selectedBrandId)?.brand_name || 'All Brands');
  // Export titles and file names say which stores: "Franchise · All Brands".
  const scopeLabel = ownershipFilter ? `${ownershipLabel(ownershipFilter)} · ${brandLabel}` : brandLabel;
  const fileScope = ownershipFilter ? `_${ownershipLabel(ownershipFilter)}` : '';

  // "Brand - Store, Location" → its brand and the rest, matched against the
  // brand list first since brand names can hold dashes ("Tien-mas").
  const splitStoreLabel = (label) => {
    const brand = brands.map(b => b.brand_name).filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .find(name => label.startsWith(`${name} - `));
    if (brand) return { brand, store: label.slice(brand.length + 3) };
    const at = label.indexOf(' - ');
    return at > 0 ? { brand: label.slice(0, at), store: label.slice(at + 3) } : { brand: '', store: label };
  };

  // The completion section's numbers, for non-compliance reporting — every
  // store-level sheet runs by brand, then store A–Z.
  const buildCompletionSheets = () => {
    if (!completion.stores.length) return [];
    const { daily, days, brands: brandTotals, finishedDays } = completion;
    // Blank, not "—", where there's no rate — a chart reads text as 0%.
    const rate = (value) => (value == null ? null : roundRate(value));
    const dayText = (day) => moment(day, 'YYYY-MM-DD').format('MMM D, YYYY');
    const incomplete = completionCapped
      ? ` · INCOMPLETE: over ${MAX_COMPLETION_ROWS.toLocaleString()} checklists in range, export a shorter range`
      : '';
    const scope = (finishedDays.length
      ? `${scopeLabel} · ${dayText(finishedDays[0])} to ${dayText(finishedDays[finishedDays.length - 1])}`
      : `${scopeLabel} · no finished days in range`) + incomplete;
    const status = (value) => (value == null ? '—' : value >= COMPLETION_TARGET
      ? { value: 'On target', styleId: 'pass' }
      : { value: 'Below target', styleId: 'fail' });
    const gridStyles = { done: 'cellDone', partial: 'cellPartial', none: 'cellNone', open: 'cellOpen', notDue: 'cellNotDue' };
    const finishedIndexes = daily.flatMap((d, i) => (d.open ? [] : [i]));

    // Native Excel charts on a sheet of their own, drawn from the sheets
    // after it — live, so editing a number in Excel updates its chart.
    const brandColor = (name) => brandSeriesColor(name, completionBrandNames).slice(1).toUpperCase();
    const trendScale = completionRateScale(finishedIndexes.flatMap(i => brandTotals.map(b => b.daily[i]).filter(d => d.required > 0).map(d => d.rate)));
    const trendStep = trendScale.ticks[1] - trendScale.ticks[0] || 25;
    const brandChartRows = Math.max(8, brandTotals.length * 2 + 4);
    const storeChartRows = Math.max(10, Math.ceil(completion.stores.length * 1.1) + 4);
    const percentAxis = { min: 0, max: 100, majorUnit: 25, format: '0"%"' };
    const chartsSheet = {
      name: 'Completion Charts',
      title: `Checklist Completion Charts — ${scope}`,
      headers: [],
      rows: [],
      fitToWidth: true,
      charts: [
        {
          type: 'line',
          title: `Daily completion % by brand (target ${COMPLETION_TARGET}%)`,
          anchor: { col: 0, row: 2, width: 10, height: 22 },
          categories: { sheet: 'Completion Trend', col: 0 },
          series: [
            ...brandTotals.map((b, i) => ({ sheet: 'Completion Trend', col: 2 + i, name: b.brandName, color: brandColor(b.brandName) })),
            { sheet: 'Completion Trend', col: 2 + brandTotals.length, name: `Target ${COMPLETION_TARGET}%`, color: '94A3B8', lineWidth: 12700 },
          ],
          valueAxis: { min: Math.floor(trendScale.domain[0] / trendStep) * trendStep, max: 100, majorUnit: trendStep, format: '0"%"' },
        },
        {
          type: 'bar',
          title: `Completion % by brand (target ${COMPLETION_TARGET}%)`,
          anchor: { col: 0, row: 26, width: 10, height: brandChartRows },
          categories: { sheet: 'Completion by Brand', col: 0 },
          series: [{ sheet: 'Completion by Brand', col: 5, name: 'Completion %', pointColors: brandTotals.map(b => brandColor(b.brandName)) }],
          valueAxis: percentAxis,
          dataLabels: '0.0"%"',
        },
        {
          type: 'bar',
          title: `Completion % by store (target ${COMPLETION_TARGET}%)`,
          anchor: { col: 0, row: 28 + brandChartRows, width: 10, height: storeChartRows },
          categories: { sheet: 'Completion by Store', col: 1 },
          series: [{ sheet: 'Completion by Store', col: 5, name: 'Completion %', pointColors: completion.stores.map(r => brandColor(r.brandName)) }],
          valueAxis: percentAxis,
          dataLabels: '0.0"%"',
        },
      ],
    };

    return [
      ...(finishedIndexes.length ? [chartsSheet] : []),
      {
        name: 'Completion by Store',
        title: `Checklist Completion by Store — ${scope} (target ${COMPLETION_TARGET}%)`,
        headers: ['Brand', 'Store', 'Checklists Due', 'Done', 'Missed', 'Completion %', 'Days All Done', 'Days With Misses', 'Status'],
        rows: completion.stores.map(r => [r.brandName, r.storeName, r.required, r.done, r.missed, rate(r.rate), r.daysAllDone, r.daysWithMisses, status(r.rate)]),
      },
      {
        name: 'Completion by Brand',
        title: `Checklist Completion by Brand — ${scope}`,
        headers: ['Brand', 'Stores', 'Checklists Due', 'Done', 'Missed', 'Completion %', 'Stores Below Target'],
        rows: brandTotals.map(b => [b.brandName, b.stores.length, b.required, b.done, b.missed, rate(b.rate), b.belowTarget]),
      },
      {
        name: 'Completion Trend',
        title: `Daily Completion % — ${scope}`,
        headers: ['Date', 'All Stores', ...brandTotals.map(b => b.brandName), 'Target %'],
        rows: finishedIndexes.map(i => [dayText(daily[i].day), rate(daily[i].rate), ...brandTotals.map(b => rate(b.daily[i].rate)), COMPLETION_TARGET]),
      },
      {
        name: 'Completion Grid',
        title: `Checklists Done per Store per Day — ${scopeLabel} · ${dayText(days[0])} to ${dayText(days[days.length - 1])}${incomplete}`,
        headers: ['Brand', 'Store', ...days.map((day, i) => `${moment(day, 'YYYY-MM-DD').format('MMM D')}${daily[i].open ? ' (so far)' : ''}`), 'Completion %'],
        columnWidths: [120, 170, ...days.map(() => 64), 90],
        rows: completion.stores.map(r => [
          r.brandName,
          r.storeName,
          ...r.cells.map(cell => ({ value: cell.required ? `${cell.done}/${cell.required}` : '—', styleId: gridStyles[completionCellState(cell)] })),
          rate(r.rate),
        ]),
      },
      {
        name: 'Missed Checklists',
        title: `Missed Checklists by Store and Day — ${scope}`,
        headers: ['Brand', 'Store', 'Date', 'Due', 'Done', 'Missed', 'Missed Checklists'],
        rows: completion.stores.flatMap(r => r.cells
          .filter(cell => !cell.open && cell.done < cell.required)
          .map(cell => [r.brandName, r.storeName, dayText(cell.day), cell.required, cell.done, cell.required - cell.done, cell.missing.map(t => t.title).join(', ')])),
      },
      {
        name: 'Completion by Checklist',
        title: `Completion by Checklist — ${scope}`,
        headers: ['Checklist', 'Stores Assigned', 'Times Due', 'Done', 'Missed', 'Completion %'],
        rows: completion.checklists.map(c => [c.title, c.stores, c.required, c.done, c.missed, rate(c.rate)]),
      },
    ];
  };

  const exportStoreSheets = async () => {
    // The NO item sheet needs every answer in range — fetched now unless a
    // report already loaded it (the reports then reuse it too).
    const { rows } = await queryClient.ensureQueryData(answersQuery);
    const exportNoItemRows = buildNoItemRows(filterDashboardRows(rows, rowFilters), auditItemLookup);
    const sheets = [
      ...buildCompletionSheets(),
      {
        name: 'Store Performance',
        title: `Store Performance Breakdown — ${scopeLabel} · ${dateFrom} to ${dateTo}`,
        headers: ['Brand', 'Store', ...visibleTemplates, 'Avg', 'Trend', 'Audits', 'Status'],
        rows: storeRows
          .map(r => ({ r, ...splitStoreLabel(r.store) }))
          .sort((a, b) => a.brand.localeCompare(b.brand) || a.store.localeCompare(b.store))
          .map(({ r, brand, store }) => [
            brand,
            store,
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
        title: `Audit Template Analytics — ${scopeLabel} · ${dateFrom} to ${dateTo}`,
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
        title: `NO Findings by Template — ${scopeLabel} · ${dateFrom} to ${dateTo}`,
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
        title: `Checklist Item NO Summary — ${scopeLabel} · ${dateFrom} to ${dateTo}`,
        headers: ['NO Rank', 'Area / Section', 'Checklist Item', 'Templates', 'Total NO', 'Stores Affected', 'Store Breakdown'],
        rows: exportNoItemRows.map((row, index) => [
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
    exportSheetsToXlsx(`Audit_Dashboard${fileScope}_Store_Checklists`, sheets);
  };

  // Not until the dates typed in have been applied and the page has
  // loaded for them — otherwise the file would hold the previous range, or
  // count every checklist as missed.
  const datesPending = dateFromInput !== dateFrom || dateToInput !== dateTo;
  const exportBlocked = preparingExport || datesPending || loadingSummary || loadingCompletion
    || (!stats && completion.stores.length === 0);

  const handleExportExcel = async () => {
    setPreparingExport(true);
    try {
      await exportStoreSheets();
    } catch (error) {
      console.error('Audit Dashboard export failed:', error);
      toast({ title: "Couldn't export the dashboard", description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setPreparingExport(false);
    }
  };

  // Shown even when nothing was submitted in range, since that's exactly
  // the 0% a non-compliance check is after.
  const completionSection = (
    <ChecklistCompletionCard
      templates={scopedCompletionTemplates}
      completion={completion}
      brandNames={completionBrandNames}
      isAdmin={isAdmin}
      selectedIds={selectedIds}
      onToggle={handleToggle}
      onSelectAll={handleSelectAll}
      onClearAll={handleClearAll}
      saving={saving}
      loading={loadingCompletion}
      capped={completionCapped}
    />
  );

  const handleExportQaExcel = () => {
    exportSheetsToExcel(`Audit_Dashboard${fileScope}_QA_Audits`, [{
      name: 'QA Audits',
      title: `QA Audits — ${scopeLabel} · ${dateFrom} to ${dateTo}`,
      headers: ['Date', 'Store', 'Checklist', 'Audit Type', 'Score', 'NCF', 'Result'],
      rows: buildQaAuditRows(qaFiltered, templateDefinitionsById).map(r => [
        r.dateText, r.submission.brand || '—', r.submission.template_title, r.auditType,
        formatScore(r.submission.score), r.ncf, r.result || '—',
      ]),
    }]);
  };

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Quality intelligence</p>
          <div>
            <h1 className="app-page-heading">Audit Dashboard</h1>
            <p className="app-page-description">
              {dashboardTab === 'qa'
                ? "QA audit results, each graded on its own checklist's pass mark."
                : `${ownershipFilter ? `${ownershipLabel(ownershipFilter)} stores'` : 'Store'} quality performance summary.`}
            </p>
          </div>
        </div>
        {dashboardTab === 'qa'
          ? <ExcelExportButton onClick={handleExportQaExcel} disabled={qaFiltered.length === 0} />
          : (
            <ExcelExportButton
              onClick={handleExportExcel}
              disabled={exportBlocked}
              label={preparingExport ? 'Preparing export…' : undefined}
            />
          )}
      </div>

      {(showQaTab || ownershipFilter) && (
        <div className="flex flex-wrap items-center gap-3">
          {showQaTab && (
            <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="max-w-full">
              <div className="overflow-x-auto">
                <TabsList className="flex h-auto w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {[{ value: 'store', label: 'Store Checklists' }, { value: 'qa', label: 'QA Audits' }].map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-lg px-4 h-9 text-slate-600 transition-all hover:text-slate-900 data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-sm"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          )}
          {/* Corporate and franchise stores never share numbers — one at a time. */}
          {ownershipFilter && (
            <Tabs value={ownershipFilter} onValueChange={changeOwnership} className="max-w-full">
              <div className="overflow-x-auto">
                <TabsList aria-label="Store ownership" className="flex h-auto w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {OWNERSHIP_OPTIONS.map(option => (
                    <TabsTrigger
                      key={option.value}
                      value={option.value}
                      className="rounded-lg px-4 h-9 text-slate-600 transition-all hover:text-slate-900 data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-sm"
                    >
                      {option.label}
                      <span className="ml-1.5 text-xs font-normal opacity-70">{ownershipCounts[option.value]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          )}
        </div>
      )}

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
          <input type="date" value={dateFromInput} onChange={e => setDateFromInput(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
          <span className="hidden text-sm text-slate-400 sm:inline">–</span>
          <input type="date" value={dateToInput} onChange={e => setDateToInput(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#1fd655]" />
          {isRealDay(dateFromInput) && isRealDay(dateToInput) && dateFromInput > dateToInput && (
            <span className="text-xs font-medium text-red-600">The end date is before the start date.</span>
          )}
        </div>
      </div>

      {dashboardTab === 'qa' ? (
        <QaAuditsPanel
          submissions={qaFiltered}
          templatesById={templateDefinitionsById}
          loading={loadingQaSubmissions}
          onOpen={setSelectedSubmission}
        />
      ) : (
        <>
          {/* Headline numbers — from the server-side summary */}
          {loadingSummary ? (
            <div className="flex justify-center py-12"><Spinner /></div>
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
                  { label: 'Overall Avg Score', value: stats.avg != null ? `${stats.avg.toFixed(1)}%` : '—', color: stats.avg != null && stats.avg >= STORE_PASS_THRESHOLD ? 'text-green-600' : 'text-red-600' },
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
                    {answersResult ? (
                      <>
                        <p className="mt-2 line-clamp-2 text-lg font-bold text-slate-900">{topNoItem?.label || 'No NO findings'}</p>
                        <p className="mt-1 text-sm text-slate-600">{topNoItem ? `${topNoItem.count} NO · ${topNoItem.storeCount} affected store${topNoItem.storeCount !== 1 ? 's' : ''}` : '—'}</p>
                      </>
                    ) : loadingAnswers ? (
                      <Spinner className="mt-3 h-6 w-6" iconClassName="text-orange-400" />
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-slate-600">Reads every answer in this range, so it loads when asked.</p>
                        <Button variant="outline" size="sm" className="mt-3 border-orange-200 bg-white text-orange-700 hover:bg-orange-100" onClick={() => setAnswersRequestedFor(answersKey)}>
                          Show top item
                        </Button>
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
            </>
          )}

          {completionSection}

          {/* Reports — NO Findings by Template always shows (it comes from
              the summary, so costs nothing extra); the rest stay collapsed
              until opened, and load then. */}
          {stats && (
            <>
              <NoFindingsByTemplateCard rows={noTemplateRows} />
              <NoFindingsByCategoryCard
                options={categoryOptions}
                value={categoryTemplateIdShown}
                onChange={setCategoryTemplateId}
                template={templateDefinitionsById[categoryResult?.templateId] || null}
                itemCounts={categoryResult?.items || null}
                loading={categoryPending}
                stale={categoryStale}
                error={categoryError}
              />
              <ReportSection id="daily" title="Daily Audit and Ticket Summary" icon={<CalendarDays className="h-4 w-4 text-[#1fd655]" />} description="Audits submitted and tickets generated each day." open={openReports.has('daily')} onToggle={toggleReport}>
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
              </ReportSection>
              <ReportSection id="templates" title="All Template Analytics" icon={<Ticket className="h-4 w-4 text-[#1fd655]" />} description="Average score, pass rate, NO findings and tickets for every template." open={openReports.has('templates')} onToggle={toggleReport}>
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
              </ReportSection>
              <ReportSection id="recent" title="Recent Audits" icon={<ListOrdered className="h-4 w-4 text-[#1fd655]" />} description={answersResult ? `${filtered.length} audits in this range — open one to see it in full and export its PDF.` : 'Every audit in this range — open one to see it in full and export its PDF.'} open={openReports.has('recent')} onToggle={toggleReport}>
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
                        {loadingAnswers ? (
                          <tr>
                            <td colSpan={8} className="px-5 py-10"><div className="flex justify-center"><Spinner /></div></td>
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
                                <Badge className={s.score >= STORE_PASS_THRESHOLD ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
                                  {s.score >= STORE_PASS_THRESHOLD ? 'PASS' : 'FAIL'}
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
              </ReportSection>
              <ReportSection id="noItems" title="Top NO Findings by Checklist Item" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} description="The 15 checklist items marked NO most often. The full ranked list is in Complete Checklist Item NO Summary." open={openReports.has('noItems')} onToggle={toggleReport}>
                <CardContent className="px-2 pb-5">
                  {loadingAnswers ? (
                    <div className="flex justify-center py-12"><Spinner /></div>
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
              </ReportSection>
              <ReportSection id="noSummary" title="Complete Checklist Item NO Summary" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} description="All NO answers in the selected date range, with total occurrences and the stores where each finding appeared." open={openReports.has('noSummary')} onToggle={toggleReport}>
                <CardContent className="px-0 pb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1150px] text-sm">
                      <thead><tr className="border-b border-slate-100 bg-slate-50">
                        {['Rank', 'Date', 'Area / Section', 'Checklist Item', 'Template', 'Total NO', 'Stores', 'Store Breakdown'].map(header => (
                          <th key={header} className={`${['Area / Section', 'Checklist Item', 'Template', 'Store Breakdown'].includes(header) ? 'text-left' : 'text-center'} px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600`}>{header}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {loadingAnswers && (
                          <tr><td colSpan={8} className="px-4 py-12"><div className="flex justify-center"><Spinner /></div></td></tr>
                        )}
                        {!loadingAnswers && noItemPagination.pageItems.map((row, index) => (
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
                        {!loadingAnswers && !noItemRows.length && (
                          <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No checklist items were marked NO for the selected filters.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination page={noItemPagination.page} totalPages={noItemPagination.totalPages} onPageChange={noItemPagination.setPage} className="px-5 pt-4" />
                </CardContent>
              </ReportSection>
              <ReportSection id="storePerf" title="Store Performance Breakdown" icon={<Store className="h-4 w-4 text-[#1fd655]" />} description="Each store's average score per template, its trend, and pass or fail." open={openReports.has('storePerf')} onToggle={toggleReport}>
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
              </ReportSection>
              <ReportSection id="noTracker" title="NO Answer Tracker" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} description="Checklist items marked NO per day, per store, to see if they get resolved to YES — uses the date range and filters above." open={openReports.has('noTracker')} onToggle={toggleReport}>
                <NoAnswerTracker embedded submissions={filtered} templates={templateDefinitions} dateFrom={dateFrom} dateTo={dateTo} loading={loadingAnswers} />
              </ReportSection>
            </>
          )}
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
                templates={templateDefinitions}
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
