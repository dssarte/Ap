import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Store as StoreIcon, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldAlert, Clock, CheckCircle2,
  Ticket as TicketIcon, CalendarDays, MapPin, ListChecks, X, FileText,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, Cell, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';
import jsPDF from 'jspdf';
import { auditBusinessDayKey, formatPHDate, formatPHDateTime } from '@/lib/dateUtils';
import { computeFrontCover } from '@/components/store-ranking/FrontCoverModal';
import ChipDetailModal from '@/components/store-ranking/ChipDetailModal';
import TemplateMultiSelect from '@/components/audit/TemplateMultiSelect';

const VISIT_OPTIONS = [
  { value: 'all', label: 'All Visits' },
  { value: 'first', label: 'First Visit' },
  { value: 'second', label: 'Second Visit' },
];

const LOGO_URL = '/assets/figaro-logo.png';

async function fetchImageBase64(url) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const DEFAULT_PASS_THRESHOLD = 75;
const OPEN_TICKET_STATUSES = new Set(['open', 'in_progress', 'pending']);
const AUDIT_TYPE_LABELS = { unannounced: 'Unannounced', follow_up: 'Follow-up', spot: 'Spot' };

// Fixed, absolute score bands (not relative to each store's own pass
// threshold) — QA wants one consistent network-wide cutoff everyone can
// recognize at a glance, instead of a bar that moves with each checklist's
// own threshold. Adjust the cutoffs here if QA wants different ranges.
const STATUS_BANDS = [
  { key: 'critical', label: 'Critical', icon: ShieldAlert, text: 'text-red-600', badge: 'bg-red-100 text-red-700 border-red-200', solid: 'bg-red-600', ring: '#dc2626', test: (score) => score < 92.5, hint: 'Score is below 92.5%' },
  { key: 'watchlist', label: 'Watchlist', icon: Clock, text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-200', solid: 'bg-amber-500', ring: '#f59e0b', test: (score) => score < 94, hint: 'Score is 92.5% to 93.99%' },
  { key: 'healthy', label: 'Healthy', icon: CheckCircle2, text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', solid: 'bg-emerald-500', ring: '#10b981', test: () => true, hint: 'Score is 94% or above' },
];

function classifyStatus(avgScore) {
  return STATUS_BANDS.find(b => b.test(avgScore));
}

const ACTION_BY_STATUS = {
  critical: 'Audit + Training',
  watchlist: 'Coaching',
  healthy: 'Maintain',
};

const PRIORITY_BY_STATUS = {
  critical: { label: 'Critical', badge: 'bg-red-100 text-red-700 border-red-200' },
  watchlist: { label: 'Medium', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  healthy: { label: 'Low', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function TrendIcon({ trend }) {
  if (trend > 1) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend < -1) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function scoreAverage(subs) {
  const yes = subs.reduce((sum, s) => sum + Number(s.yes_count || 0), 0);
  const no = subs.reduce((sum, s) => sum + Number(s.no_count || 0), 0);
  return (yes + no) > 0 ? (yes / (yes + no)) * 100 : null;
}

// One point per individual audit (not blended) so a store that failed one
// visit and passed the next shows as a dip-then-recovery, not just a single
// averaged number — this is what actually answers "are they improving".
function buildAuditHistory(submissions, passThreshold) {
  return [...submissions]
    .sort((a, b) => new Date(a.submission_date || a.created_date) - new Date(b.submission_date || b.created_date))
    .map(s => ({
      id: s.id,
      dateLabel: formatPHDate(s.submission_date || s.created_date),
      rawDate: s.submission_date || s.created_date,
      score: Number(s.score) || 0,
      pass: (Number(s.score) || 0) >= passThreshold,
      auditType: s.audit_type ? AUDIT_TYPE_LABELS[s.audit_type] || s.audit_type : null,
      templateTitle: s.template_title || null,
    }));
}

function ScoreRing({ score, color, size = 110, strokeWidth = 11 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-extrabold text-slate-900">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function QADashboard() {
  const [user, setUser] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]); // [] = all QA templates
  const [selectedVisitNumber, setSelectedVisitNumber] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => moment().utcOffset(8).format('YYYY-MM-DD'));
  const [detailStore, setDetailStore] = useState(null);
  const [fullDrilldownStore, setFullDrilldownStore] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [exportingDetailPdf, setExportingDetailPdf] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-active-qa-dashboard'],
    queryFn: () => base44.entities.Store.filter({ is_active: true, kind: 'store' }, 'store_name', 500),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['audit-templates-all-qa-dashboard'],
    queryFn: () => base44.entities.AuditTemplate.list('title', 200),
  });

  // Same rule Store Ranking uses: a template counts as a QA audit either
  // because it has no store restrictions at all, or because it's explicitly
  // marked as a QA visit ("Ask Audit Type") even though it's restricted to a
  // specific brand's stores for scoping convenience. Store-only operational
  // checklists (Opening/Closing/OD/Mid) are excluded either way.
  const qaTemplateIds = useMemo(() => new Set(
    templates.filter(t => t.requires_audit_type || !(t.store_restrictions?.length > 0 || t.store_name)).map(t => t.id)
  ), [templates]);

  // Scoped to just the QA checklists server-side — these happen a handful
  // of times a month per store, while every store's daily operational
  // checklists (Opening/OD/Mid/Closing) vastly outnumber them. Fetching
  // those too and discarding them client-side is what made a wide date
  // range time out.
  const qaTemplateIdList = useMemo(() => [...qaTemplateIds].sort(), [qaTemplateIds]);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['qa-dashboard-submissions', dateFrom, dateTo, qaTemplateIdList.join(',')],
    queryFn: () => base44.audit.listSubmissions({ dateFrom, dateTo, templateIds: qaTemplateIdList, maxRows: 25000 }),
    enabled: !!user && qaTemplateIdList.length > 0,
  });

  const { data: generatedTickets = [] } = useQuery({
    queryKey: ['qa-dashboard-generated-tickets', dateFrom, dateTo],
    queryFn: () => base44.audit.listGeneratedTickets({ dateFrom, dateTo, maxRows: 25000 }),
    enabled: !!user,
  });

  const templateThresholds = useMemo(() => {
    const map = {};
    templates.forEach(t => { map[t.id] = Number(t.pass_threshold ?? DEFAULT_PASS_THRESHOLD); });
    return map;
  }, [templates]);

  const templatesById = useMemo(() => {
    const map = {};
    templates.forEach(t => { map[t.id] = t; });
    return map;
  }, [templates]);

  const visibleStores = useMemo(() => {
    if (selectedBrandId === 'all') return stores;
    return stores.filter(s => s.brand_id === selectedBrandId);
  }, [stores, selectedBrandId]);

  // Template options for the filter — just the QA checklists this
  // dashboard already scopes to, not every template in the system.
  const qaTemplatesList = useMemo(
    () => templates.filter(t => qaTemplateIds.has(t.id)),
    [templates, qaTemplateIds]
  );

  // The Visit filter only makes sense once a checklist that actually asks
  // for one is in play — shown whenever that's true of the current
  // Template selection (or of any QA checklist at all, when nothing's
  // narrowed down yet), and ignored otherwise so a stale pick can't
  // silently filter out everything.
  const templatesInPlayHaveVisit = useMemo(() => {
    const pool = selectedTemplateIds.length
      ? qaTemplatesList.filter(t => selectedTemplateIds.includes(t.id))
      : qaTemplatesList;
    return pool.some(t => t.requires_visit_number);
  }, [qaTemplatesList, selectedTemplateIds]);

  const filtered = useMemo(() => {
    let subs = submissions.filter(s => s.brand && qaTemplateIds.has(s.template_id) && s.score != null);
    if (selectedBrandId !== 'all') {
      const brand = brands.find(b => b.id === selectedBrandId);
      if (brand) subs = subs.filter(s => s.brand.startsWith(brand.brand_name));
    }
    if (selectedTemplateIds.length) {
      subs = subs.filter(s => selectedTemplateIds.includes(s.template_id));
    }
    if (templatesInPlayHaveVisit && selectedVisitNumber !== 'all') {
      subs = subs.filter(s => (s.visit_number || '') === selectedVisitNumber);
    }
    return subs;
  }, [submissions, qaTemplateIds, brands, selectedBrandId, selectedTemplateIds, templatesInPlayHaveVisit, selectedVisitNumber]);

  const ticketsBySubmissionId = useMemo(() => {
    const map = new Map();
    generatedTickets.forEach(t => {
      if (!t.audit_submission_id) return;
      if (!map.has(t.audit_submission_id)) map.set(t.audit_submission_id, []);
      map.get(t.audit_submission_id).push(t);
    });
    return map;
  }, [generatedTickets]);

  // Per-store roll-up: blended score/threshold (same formula as the Front
  // Cover "Average Rating"), status band, trend, worst-performing section,
  // and open concern-ticket count — feeds both the Store Performance table
  // and the Store Prioritization panel, since they're the same underlying
  // ranking just displayed two ways.
  const storeRows = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const key = s.brand;
      if (!groups[key]) groups[key] = { store: key, submissions: [] };
      groups[key].submissions.push(s);
    });

    return Object.values(groups).map(g => {
      const subs = g.submissions;
      const avgScore = scoreAverage(subs) ?? 0;

      const byTemplate = {};
      subs.forEach(s => {
        if (!byTemplate[s.template_id]) byTemplate[s.template_id] = { yes: 0, no: 0 };
        byTemplate[s.template_id].yes += Number(s.yes_count || 0);
        byTemplate[s.template_id].no += Number(s.no_count || 0);
      });
      const answered = Object.values(byTemplate).reduce((sum, t) => sum + t.yes + t.no, 0);
      const weightedThreshold = Object.entries(byTemplate).reduce((sum, [templateId, t]) => {
        const items = t.yes + t.no;
        return sum + (templateThresholds[templateId] ?? DEFAULT_PASS_THRESHOLD) * items;
      }, 0);
      const passThreshold = answered > 0 ? weightedThreshold / answered : DEFAULT_PASS_THRESHOLD;

      // Trend: split this store's submissions chronologically in half and
      // compare early vs. recent average score — same convention Audit
      // Dashboard already uses for its own per-store trend arrows.
      const sorted = [...subs].sort((a, b) => new Date(a.submission_date || a.created_date) - new Date(b.submission_date || b.created_date));
      const mid = Math.floor(sorted.length / 2);
      const earlyAvg = scoreAverage(sorted.slice(0, mid)) ?? avgScore;
      const lateAvg = scoreAverage(sorted.slice(mid)) ?? avgScore;
      const trend = lateAvg - earlyAvg;

      const status = classifyStatus(avgScore);

      const { sectionRows } = computeFrontCover(subs, templatesById);
      const worstSection = sectionRows.length ? [...sectionRows].sort((a, b) => b.no - a.no)[0] : null;
      const mainIssue = worstSection && worstSection.no > 0 ? worstSection.title : 'No findings';

      const openTickets = subs
        .flatMap(s => ticketsBySubmissionId.get(s.id) || [])
        .filter(t => OPEN_TICKET_STATUSES.has(t.status));

      const lastAudit = sorted[sorted.length - 1];
      const storeRecord = stores.find(s => g.store.toLowerCase().includes(s.store_name.toLowerCase()));

      return {
        store: g.store,
        location: storeRecord?.location || null,
        avgScore,
        passThreshold,
        trend,
        count: subs.length,
        status,
        mainIssue,
        sectionRows,
        openTickets,
        lastAuditDate: lastAudit?.submission_date || lastAudit?.created_date || null,
        templatesUsed: [...new Set(subs.map(s => s.template_title))].join(', '),
        submissions: subs,
      };
    }).sort((a, b) => a.avgScore - b.avgScore); // worst first = priority order
  }, [filtered, templateThresholds, templatesById, ticketsBySubmissionId, stores]);

  const networkOverview = useMemo(() => {
    const counts = { critical: 0, watchlist: 0, healthy: 0 };
    storeRows.forEach(r => { counts[r.status.key] += 1; });
    return { total: storeRows.length, ...counts };
  }, [storeRows]);

  // Stores with zero QA submissions in the selected range — a coverage gap
  // QA can't see from the score table alone (a store with no audit at all
  // doesn't show up there, even though that's its own kind of risk).
  const storesNotAudited = useMemo(() => {
    const auditedNames = new Set(storeRows.map(r => r.store.toLowerCase()));
    return visibleStores.filter(s => ![...auditedNames].some(name => name.includes(s.store_name.toLowerCase())));
  }, [visibleStores, storeRows]);

  // Month-bucketed overall average score (same blended formula), for the
  // Audit Trend chart.
  const trendData = useMemo(() => {
    const byMonth = {};
    filtered.forEach(s => {
      const key = auditBusinessDayKey(s);
      if (!key) return;
      const month = moment(key, 'YYYY-MM-DD').format('MMM YYYY');
      if (!byMonth[month]) byMonth[month] = { month, yes: 0, no: 0, sortKey: key };
      byMonth[month].yes += Number(s.yes_count || 0);
      byMonth[month].no += Number(s.no_count || 0);
    });
    return Object.values(byMonth)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(m => ({
        month: m.month,
        score: (m.yes + m.no) > 0 ? parseFloat(((m.yes / (m.yes + m.no)) * 100).toFixed(1)) : null,
      }));
  }, [filtered]);

  const trendDelta = useMemo(() => {
    const withScores = trendData.filter(d => d.score != null);
    if (withScores.length < 2) return null;
    return withScores[withScores.length - 1].score - withScores[withScores.length - 2].score;
  }, [trendData]);

  // Per-checklist (template) performance network-wide — which QA checklist
  // type is struggling the most, across every store using it.
  const checklistRows = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const key = s.template_id;
      if (!groups[key]) groups[key] = { title: s.template_title, yes: 0, no: 0, audits: 0, passing: 0, threshold: templateThresholds[key] ?? DEFAULT_PASS_THRESHOLD };
      groups[key].yes += Number(s.yes_count || 0);
      groups[key].no += Number(s.no_count || 0);
      groups[key].audits += 1;
      if (Number(s.score) >= groups[key].threshold) groups[key].passing += 1;
    });
    return Object.values(groups).map(g => ({
      title: g.title,
      avg: (g.yes + g.no) > 0 ? (g.yes / (g.yes + g.no)) * 100 : 0,
      passRate: g.audits ? (g.passing / g.audits) * 100 : 0,
      audits: g.audits,
    })).sort((a, b) => a.avg - b.avg);
  }, [filtered, templateThresholds]);

  // Every NO-answer item network-wide, ranked by how often it recurs —
  // feeds both "Top Recurring" (systemic, high-count issues) and "Low
  // Recurring" (rare, likely one-off issues) below.
  const noItemStats = useMemo(() => {
    const groups = new Map();
    filtered.forEach(submission => {
      const template = templatesById[submission.template_id];
      Object.entries(submission.answers || {}).forEach(([itemId, answer]) => {
        if (String(answer || '').trim().toUpperCase() !== 'NO') return;
        let sectionTitle = 'General';
        let itemLabel = itemId;
        template?.sections?.forEach(sec => {
          const item = sec.items?.find(it => it.id === itemId);
          if (item) { sectionTitle = sec.title; itemLabel = item.label; }
        });
        const key = `${sectionTitle.toLowerCase()}::${itemLabel.toLowerCase()}`;
        const group = groups.get(key) || { label: `${sectionTitle} — ${itemLabel}`, count: 0, stores: new Map() };
        group.count += 1;
        group.stores.set(submission.brand, (group.stores.get(submission.brand) || 0) + 1);
        groups.set(key, group);
      });
    });
    return Array.from(groups.values()).map(g => ({
      ...g,
      storeCount: g.stores.size,
      storeEntries: Array.from(g.stores.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    }));
  }, [filtered, templatesById]);

  const topNoItems = useMemo(
    () => [...noItemStats].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 8),
    [noItemStats]
  );

  // Items that only came up once or twice — not necessarily a systemic gap,
  // but worth a quick look in case something isolated is slipping through.
  const lowNoItems = useMemo(
    () => [...noItemStats].sort((a, b) => a.count - b.count || a.label.localeCompare(b.label)).slice(0, 8),
    [noItemStats]
  );

  // Audit Type mix (Unannounced / Follow-up / Spot) across QA checklists
  // that ask for one.
  const auditTypeMix = useMemo(() => {
    const counts = { unannounced: 0, follow_up: 0, spot: 0 };
    filtered.forEach(s => { if (counts[s.audit_type] !== undefined) counts[s.audit_type] += 1; });
    const total = counts.unannounced + counts.follow_up + counts.spot;
    return { ...counts, total };
  }, [filtered]);

  const topAlerts = useMemo(() => {
    const alerts = [];
    const totalOpenTickets = storeRows.reduce((sum, r) => sum + r.openTickets.length, 0);
    if (totalOpenTickets > 0) {
      alerts.push({ key: 'open-tickets', level: 'info', text: `${totalOpenTickets} open audit concern ticket${totalOpenTickets === 1 ? '' : 's'} across all stores` });
    }
    if (storesNotAudited.length > 0) {
      alerts.push({ key: 'not-audited', level: 'not_audited', text: `${storesNotAudited.length} store${storesNotAudited.length === 1 ? '' : 's'} with no QA audit in this range` });
    }
    storeRows.filter(r => r.status.key === 'critical').forEach(r => {
      alerts.push({ key: `critical-${r.store}`, level: 'critical', text: `${r.store} is Critical (${r.avgScore.toFixed(0)}% — ${r.mainIssue})` });
    });
    storeRows.filter(r => r.trend < -5).forEach(r => {
      alerts.push({ key: `decline-${r.store}`, level: 'decline', text: `${r.store} is declining (${r.trend.toFixed(1)} pts this range)` });
    });
    return alerts.slice(0, 8);
  }, [storeRows, storesNotAudited]);

  const brandLabel = selectedBrandId === 'all' ? 'All Brands' : (brands.find(b => b.id === selectedBrandId)?.brand_name || 'All Brands');

  // Exports exactly what the Store Detail panel shows — status/score summary,
  // the full audit history (one row per individual audit, not blended), the
  // section breakdown bars, and any open concern tickets.
  const handleExportStoreDetailPdf = async (store) => {
    setExportingDetailPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentW = pageW - margin * 2;
      const logoBase64 = await fetchImageBase64(LOGO_URL);
      let y = 8;

      const addPageIfNeeded = (needed = 10) => {
        if (y + needed > pageH - 10) {
          doc.addPage();
          y = 12;
        }
      };

      doc.setFillColor(31, 214, 85);
      doc.rect(0, 0, pageW, 3, 'F');

      const logoW = 20, logoH = 20;
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, y, logoW, logoH);
        doc.addImage(logoBase64, 'PNG', pageW - margin - logoW, y, logoW, logoH);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(31, 65, 154);
      doc.text('FIGARO COFFEE SYSTEM, INC.', pageW / 2, y + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('QUALITY ASSURANCE DEPARTMENT', pageW / 2, y + 10.5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(`${store.store.toUpperCase()} — QA DASHBOARD DETAIL`, pageW / 2, y + 17, { align: 'center' });
      y += logoH + 5;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 7;

      // Status + score summary
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, 22, 2, 2, 'FD');

      const statusRgb = {
        critical: [220, 38, 38], watchlist: [245, 158, 11], healthy: [16, 185, 129],
      }[store.status.key];
      doc.setFillColor(...statusRgb);
      doc.roundedRect(margin + 3, y + 3, 28, 16, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`${store.avgScore.toFixed(0)}%`, margin + 17, y + 10, { align: 'center' });
      doc.setFontSize(7);
      doc.text(store.status.label.toUpperCase(), margin + 17, y + 15.5, { align: 'center' });

      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Pass Threshold', margin + 36, y + 6);
      doc.text('Last Audit', margin + 36, y + 13);
      doc.text('Audits in Range', margin + 95, y + 6);
      doc.text('Open Concern Tickets', margin + 95, y + 13);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);
      doc.text(`${Math.round(store.passThreshold * 10) / 10}%`, margin + 65, y + 6);
      doc.text(store.lastAuditDate ? formatPHDate(store.lastAuditDate) : '—', margin + 65, y + 13);
      doc.text(String(store.count), margin + 140, y + 6);
      doc.setTextColor(...(store.openTickets.length ? [220, 38, 38] : [30, 30, 30]));
      doc.text(String(store.openTickets.length), margin + 150, y + 13);

      y += 26;

      if (store.location) {
        addPageIfNeeded(8);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('LOCATION', margin, y);
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(store.location, margin + 22, y);
        y += 6;
      }

      if (store.templatesUsed) {
        addPageIfNeeded(8);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('CHECKLIST(S) AUDITED', margin, y);
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const wrapped = doc.splitTextToSize(store.templatesUsed, contentW - 45);
        doc.text(wrapped, margin + 42, y);
        y += wrapped.length * 4 + 4;
      }

      y += 2;

      // Audit History
      const history = buildAuditHistory(store.submissions, store.passThreshold);
      addPageIfNeeded(14);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, 'F');
      doc.setTextColor(21, 128, 61);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('AUDIT HISTORY', margin + 3, y + 5);
      y += 10;

      if (history.length === 0) {
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('No audits in the selected date range.', margin, y);
        y += 6;
      } else {
        const colX = [margin, margin + 38, margin + 100, margin + 128];
        addPageIfNeeded(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Date', colX[0], y);
        doc.text('Audit Type', colX[1], y);
        doc.text('Score', colX[2], y);
        doc.text('Result', colX[3], y);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, margin + contentW, y);
        y += 4;

        history.forEach(h => {
          addPageIfNeeded(6);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          doc.text(h.dateLabel, colX[0], y);
          doc.text(h.auditType || '—', colX[1], y);
          doc.text(`${h.score.toFixed(0)}%`, colX[2], y);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...(h.pass ? [16, 185, 129] : [239, 68, 68]));
          doc.text(h.pass ? 'PASS' : 'FAIL', colX[3], y);
          y += 5.5;
        });
      }

      y += 4;

      // Breakdown by Section
      addPageIfNeeded(14);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, 'F');
      doc.setTextColor(21, 128, 61);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('BREAKDOWN BY SECTION', margin + 3, y + 5);
      y += 10;

      store.sectionRows.forEach(row => {
        addPageIfNeeded(9);
        const answered = row.yes + row.no;
        const pct = answered > 0 ? (row.yes / answered) * 100 : 100;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(60, 60, 60);
        const label = doc.splitTextToSize(row.title, contentW - 30)[0];
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'bold');
        doc.text(`${pct.toFixed(0)}%`, margin + contentW, y, { align: 'right' });
        y += 2;
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(margin, y, contentW, 2.2, 1, 1, 'F');
        doc.setFillColor(...(pct >= store.passThreshold ? [16, 185, 129] : [239, 68, 68]));
        doc.roundedRect(margin, y, Math.max(2, (pct / 100) * contentW), 2.2, 1, 1, 'F');
        y += 6;
      });

      // Open Concern Tickets
      if (store.openTickets.length > 0) {
        y += 2;
        addPageIfNeeded(14);
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(margin, y, contentW, 7, 1.5, 1.5, 'F');
        doc.setTextColor(185, 28, 28);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`OPEN CONCERN TICKETS (${store.openTickets.length})`, margin + 3, y + 5);
        y += 10;

        store.openTickets.forEach(t => {
          addPageIfNeeded(8);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          const titleWrapped = doc.splitTextToSize(t.title, contentW - 30);
          doc.text(titleWrapped, margin, y);
          doc.setTextColor(150, 150, 150);
          doc.setFontSize(7.5);
          doc.text(formatPHDate(t.created_date), margin + contentW, y, { align: 'right' });
          y += titleWrapped.length * 4 + 2;
        });
      }

      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated ${formatPHDateTime(new Date().toISOString())} — QA Dashboard`, margin, pageH - 6);

      doc.save(`qa-store-detail_${store.store.replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportingDetailPdf(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="app-page app-page-narrow">
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Data-driven quality management</p>
          <h1 className="app-page-heading">QA Dashboard</h1>
          <p className="app-page-description">Network-wide store quality health, trends, and priorities.</p>
        </div>
      </div>

      <div className="app-filter-bar">
        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger className="w-52 h-9">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TemplateMultiSelect
          templates={qaTemplatesList}
          selected={selectedTemplateIds}
          onChange={setSelectedTemplateIds}
          maxSelected={null}
          placeholder="All Checklists"
        />

        {templatesInPlayHaveVisit && (
          <Select value={selectedVisitNumber} onValueChange={setSelectedVisitNumber}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="All Visits" />
            </SelectTrigger>
            <SelectContent>
              {VISIT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
          />
          <span className="hidden text-sm text-slate-400 sm:inline">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : storeRows.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <StoreIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No QA audit submissions found for the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Network Overview */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border-2 border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900/5 flex items-center justify-center flex-shrink-0">
                  <StoreIcon className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Stores</p>
                  <p className="text-2xl font-extrabold text-slate-900">{networkOverview.total}</p>
                </div>
              </CardContent>
            </Card>
            {STATUS_BANDS.map(band => {
              const Icon = band.icon;
              return (
                <Card key={band.key} className="border-2 border-slate-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${band.badge} flex items-center justify-center flex-shrink-0 border-0`}>
                      <Icon className={`w-5 h-5 ${band.text}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{band.label}</p>
                      <p className="text-2xl font-extrabold text-slate-900">
                        {networkOverview[band.key]}
                        <span className="text-sm font-semibold text-slate-400 ml-1">
                          ({networkOverview.total ? Math.round((networkOverview[band.key] / networkOverview.total) * 100) : 0}%)
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* What each status means, relative to the store's own pass threshold */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1 -mt-1">
            {STATUS_BANDS.map(band => (
              <p key={band.key} className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${band.solid} flex-shrink-0`} />
                <span className={`font-semibold ${band.text}`}>{band.label}</span>
                <span>— {band.hint}</span>
              </p>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Audit Trend */}
            <Card className="border-2 border-slate-200 lg:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-slate-900">Audit Trend — {brandLabel}</p>
                  {trendDelta != null && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendDelta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {trendDelta >= 0 ? '+' : ''}{trendDelta.toFixed(1)}% vs prior month
                    </span>
                  )}
                </div>
                {trendData.length < 2 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">Not enough history in this range to chart a trend yet — widen the date range above.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Line type="monotone" dataKey="score" name="Avg Score" stroke="#1fd655" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Priority Alerts */}
            <Card className="border-2 border-slate-200">
              <CardContent className="p-5">
                <p className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Top Priority Alerts
                </p>
                {topAlerts.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No alerts — every store is Healthy or Watchlist with a stable trend.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {topAlerts.map(alert => (
                      <li key={alert.key} className="flex items-start gap-2 text-sm">
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          alert.level === 'critical' ? 'bg-red-500'
                            : alert.level === 'not_audited' ? 'bg-orange-500'
                            : alert.level === 'decline' ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`} />
                        <span className="text-slate-700 leading-snug">{alert.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Store Performance + Store Prioritization */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="border-2 border-slate-200 lg:col-span-2">
              <CardContent className="p-0">
                <div className="p-5 pb-3">
                  <p className="font-bold text-slate-900">Store Performance</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click a store for its detail view.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Store</th>
                        <th className="px-4 py-2 text-center">Score</th>
                        <th className="px-4 py-2 text-center">Trend</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Main Issue</th>
                        <th className="px-4 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeRows.map((row, idx) => (
                        <tr
                          key={row.store}
                          className="border-t border-slate-100 hover:bg-emerald-50/60 cursor-pointer"
                          onClick={() => setDetailStore(row)}
                        >
                          <td className="px-4 py-3 text-slate-400 font-semibold">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{row.store}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">{row.avgScore.toFixed(1)}%</td>
                          <td className="px-4 py-3"><div className="flex items-center justify-center"><TrendIcon trend={row.trend} /></div></td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${row.status.badge}`}>{row.status.label}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.mainIssue}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold text-white ${row.status.solid}`}>
                              {ACTION_BY_STATUS[row.status.key]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200">
              <CardContent className="p-5">
                <p className="font-bold text-slate-900 mb-1">Store Prioritization</p>
                <p className="text-xs text-slate-400 mb-3">Focused support where it matters most.</p>
                <ul className="divide-y divide-slate-100">
                  {storeRows.slice(0, 8).map((row, idx) => (
                    <li
                      key={row.store}
                      className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                      onClick={() => setDetailStore(row)}
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">#{idx + 1}</p>
                        <p className="font-semibold text-slate-900 truncate text-sm">{row.store}</p>
                        <p className="text-xs text-slate-500 truncate">{row.mainIssue}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-sm font-bold text-slate-900">{row.avgScore.toFixed(0)}%</span>
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${PRIORITY_BY_STATUS[row.status.key].badge}`}>
                          {PRIORITY_BY_STATUS[row.status.key].label}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Checklist Pass Rate + Audit Type Mix */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="border-2 border-slate-200 lg:col-span-2">
              <CardContent className="p-5">
                <p className="font-bold text-slate-900 mb-3">Checklist Pass Rate — {brandLabel}</p>
                <ResponsiveContainer width="100%" height={Math.max(160, checklistRows.length * 42)}>
                  <BarChart data={checklistRows} layout="vertical" margin={{ left: 12, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="title" width={180} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="avg" name="Avg Score" radius={[0, 4, 4, 0]}>
                      {checklistRows.map((row, i) => (
                        <Cell key={i} fill={row.avg >= row.threshold ? '#1fd655' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200">
              <CardContent className="p-5">
                <p className="font-bold text-slate-900 mb-3">Audit Type Mix</p>
                {auditTypeMix.total === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No QA checklists in this range ask for an Audit Type.</p>
                ) : (
                  <ul className="space-y-3">
                    {[
                      { key: 'unannounced', label: 'Unannounced', color: 'bg-blue-500' },
                      { key: 'follow_up', label: 'Follow-up', color: 'bg-purple-500' },
                      { key: 'spot', label: 'Spot', color: 'bg-cyan-500' },
                    ].map(t => {
                      const pct = auditTypeMix.total ? (auditTypeMix[t.key] / auditTypeMix.total) * 100 : 0;
                      return (
                        <li key={t.key}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-600">{t.label}</span>
                            <span className="text-slate-400">{auditTypeMix[t.key]} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full ${t.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Recurring + Low Recurring Issues */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-2 border-slate-200">
              <CardContent className="p-5">
                <p className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-slate-500" /> Top Recurring Issues — Network-Wide
                </p>
                <p className="text-xs text-slate-400 mb-3">Checklist items most often marked NO, across every store — likely a systemic gap.</p>
                {topNoItems.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No NO answers in this range.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {topNoItems.map((item) => (
                      <li
                        key={item.label}
                        className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                        onClick={() => setSelectedIssue(item)}
                      >
                        <span className="text-sm text-slate-700 min-w-0 truncate">{item.label}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{item.count}× · {item.storeCount} store{item.storeCount === 1 ? '' : 's'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200">
              <CardContent className="p-5">
                <p className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-slate-500" /> Low Recurring Issues — Network-Wide
                </p>
                <p className="text-xs text-slate-400 mb-3">Checklist items marked NO the least — likely isolated, one-off findings.</p>
                {lowNoItems.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No NO answers in this range.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {lowNoItems.map((item) => (
                      <li
                        key={item.label}
                        className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                        onClick={() => setSelectedIssue(item)}
                      >
                        <span className="text-sm text-slate-700 min-w-0 truncate">{item.label}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{item.count}× · {item.storeCount} store{item.storeCount === 1 ? '' : 's'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Audit Coverage */}
          <Card className="border-2 border-slate-200">
            <CardContent className="p-5">
              <p className="font-bold text-slate-900 mb-1">Audit Coverage</p>
                <p className="text-xs text-slate-400 mb-3">Which active stores have (and haven't) had a QA audit in this range.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-2">Audited ({storeRows.length})</p>
                    {storeRows.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">None yet.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                        {storeRows.map(r => (
                          <li
                            key={r.store}
                            className="py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 -mx-1 px-1 rounded"
                            onClick={() => setDetailStore(r)}
                          >
                            <span className="text-sm text-slate-700 truncate">{r.store}</span>
                            <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{r.avgScore.toFixed(0)}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-red-500 mb-2">Not Audited ({storesNotAudited.length})</p>
                    {storesNotAudited.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">Every active store has at least one audit.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                        {storesNotAudited.map(s => (
                          <li key={s.id} className="py-2 text-sm font-medium text-slate-700 truncate">
                            {s.brand_name} — {s.store_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>
      )}

      {/* Store Detail View */}
      {detailStore && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/35 backdrop-blur-sm p-0 sm:p-4" onClick={() => setDetailStore(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-start justify-between gap-3 z-10">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold mb-1 ${detailStore.status.badge}`}>{detailStore.status.label}</span>
                <h2 className="text-xl font-extrabold text-slate-900">{detailStore.store}</h2>
                {detailStore.location && (
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {detailStore.location}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleExportStoreDetailPdf(detailStore)}
                  disabled={exportingDetailPdf}
                  className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-bold gap-2"
                >
                  {exportingDetailPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Export PDF
                </Button>
                <button onClick={() => setDetailStore(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex flex-wrap items-center gap-6">
                <ScoreRing score={detailStore.avgScore} color={detailStore.status.ring} />
                <div className="flex-1 min-w-[200px] grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Last Audit</p>
                    <p className="font-semibold text-slate-900 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                      {detailStore.lastAuditDate ? formatPHDate(detailStore.lastAuditDate) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Audits in Range</p>
                    <p className="font-semibold text-slate-900">{detailStore.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Open Concern Tickets</p>
                    <p className={`font-semibold flex items-center gap-1 ${detailStore.openTickets.length ? 'text-red-600' : 'text-slate-900'}`}>
                      <TicketIcon className="w-3.5 h-3.5" /> {detailStore.openTickets.length}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">Checklist(s) Audited</p>
                    <p className="font-semibold text-slate-900 text-sm">{detailStore.templatesUsed || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Audit History — Improving or Not?</p>
                <p className="text-xs text-slate-400 mb-2">Every individual audit in the selected date range, not blended — widen the range above for more history.</p>
                {(() => {
                  const history = buildAuditHistory(detailStore.submissions, detailStore.passThreshold);
                  if (history.length < 2) {
                    return (
                      <p className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                        Only {history.length} audit{history.length === 1 ? '' : 's'} in this range — widen the date range to see a trend.
                      </p>
                    );
                  }
                  return (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={history} margin={{ left: -16, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value, name, props) => [`${value}%${props.payload.auditType ? ` · ${props.payload.auditType}` : ''}`, props.payload.pass ? 'Passed' : 'Failed']}
                          />
                          <ReferenceLine y={detailStore.passThreshold} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Pass ≥ ${Math.round(detailStore.passThreshold * 10) / 10}%`, fontSize: 10, fill: '#94a3b8', position: 'insideTopRight' }} />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#1fd655"
                            strokeWidth={2}
                            dot={(props) => (
                              <circle key={props.payload.id} cx={props.cx} cy={props.cy} r={4} fill={props.payload.pass ? '#10b981' : '#ef4444'} stroke="#fff" strokeWidth={1.5} />
                            )}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <ul className="flex flex-wrap gap-x-2 gap-y-2 mt-2">
                        {history.map(h => (
                          <li key={h.id} className="flex flex-col items-center gap-1">
                            <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${h.pass ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {h.dateLabel} · {h.score.toFixed(0)}%{h.auditType ? ` · ${h.auditType}` : ''}
                            </span>
                            {h.templateTitle && (
                              <span className="text-[10px] text-slate-400 text-center max-w-[140px] leading-tight">{h.templateTitle}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Breakdown by Section</p>
                <div className="space-y-2">
                  {detailStore.sectionRows.map(row => {
                    const answered = row.yes + row.no;
                    const pct = answered > 0 ? (row.yes / answered) * 100 : 100;
                    return (
                      <div key={row.title}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-600">{row.title}</span>
                          <span className="text-slate-400">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full ${pct >= detailStore.passThreshold ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {detailStore.openTickets.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Open Concern Tickets</p>
                  <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                    {detailStore.openTickets.slice(0, 10).map(t => (
                      <li key={t.id} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                        <span className="text-slate-700 truncate">{t.title}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{formatPHDate(t.created_date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setFullDrilldownStore(detailStore); setDetailStore(null); }}
              >
                View Full Front Cover & Audit Submissions
              </Button>
            </div>
          </div>
        </div>
      )}

      {fullDrilldownStore && (
        <ChipDetailModal
          label={fullDrilldownStore.store}
          submissions={fullDrilldownStore.submissions}
          templatesById={templatesById}
          passThreshold={fullDrilldownStore.passThreshold}
          onClose={() => setFullDrilldownStore(null)}
        />
      )}

      <Dialog open={!!selectedIssue} onOpenChange={(open) => { if (!open) setSelectedIssue(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedIssue?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400 -mt-2">
            Marked NO {selectedIssue?.count} time{selectedIssue?.count === 1 ? '' : 's'} across {selectedIssue?.storeCount} store{selectedIssue?.storeCount === 1 ? '' : 's'} in this range.
          </p>
          <ul className="divide-y divide-slate-100">
            {selectedIssue?.storeEntries.map(([storeName, count]) => {
              const row = storeRows.find(r => r.store === storeName);
              return (
                <li
                  key={storeName}
                  className={`py-2.5 flex items-center justify-between gap-3 ${row ? 'cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg' : ''}`}
                  onClick={row ? () => { setSelectedIssue(null); setDetailStore(row); } : undefined}
                >
                  <span className="text-sm font-medium text-slate-700 truncate">{storeName}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{count}×</span>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
