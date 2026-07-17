import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardCheck, CheckCircle2, XCircle, Store, CalendarDays } from 'lucide-react';
import moment from 'moment';
import { formatPHDate } from '@/lib/dateUtils';
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';

const PASS_THRESHOLD = 100; // a store "finished" when 100% of its required checklists are done

function dayKey(dateStr) {
  return moment(dateStr).utcOffset(8).format('YYYY-MM-DD');
}

// Does this template apply to a given store name?
function templateAppliesToStore(t, storeName) {
  if (!storeName) return false;
  const restrictions = t.store_restrictions?.length > 0
    ? t.store_restrictions
    : t.store_name ? [{ store_name: t.store_name }] : [];
  if (restrictions.length === 0) return false;
  return restrictions.some(r => r.store_name === storeName);
}

export default function DailySummary() {
  const [user, setUser] = useState(null);
  const today = moment().utcOffset(8).format('YYYY-MM-DD');
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const isAdmin = user?.user_type === 'admin';
  const isStoreManager = user?.user_type === 'store_manager';
  const canAccess = isAdmin || isStoreManager;
  const assignedStores = user?.assigned_stores || [];

  const { data: allTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['audit-templates-active-daily'],
    queryFn: () => base44.entities.AuditTemplate.filter({ is_active: true }, '-created_date', 200),
    enabled: !!user && canAccess,
  });

  const { data: stores = [], isLoading: loadingStores } = useQuery({
    queryKey: ['stores-active-daily'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'store_name', 500),
    enabled: !!user && canAccess,
  });

  const { data: submissions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['audit-submissions-daily'],
    queryFn: () => base44.entities.AuditSubmission.list('-created_date', 500),
    enabled: !!user && canAccess,
  });

  const { data: configRecords = [] } = useQuery({
    queryKey: ['checklist-completion-config'],
    queryFn: () => base44.entities.ChecklistConfig.filter({ config_key: 'default' }, '-updated_date', 10),
    enabled: !!user && canAccess,
  });
  const configRecord = configRecords[0];

  // Only store-restricted templates count toward daily completion (QA audits excluded)
  const completionTemplates = useMemo(
    () => allTemplates.filter(t => t.store_restrictions?.length > 0 || t.store_name),
    [allTemplates]
  );
  const requiredIds = useMemo(
    () => configRecord?.selected_template_ids?.length
      ? configRecord.selected_template_ids
      : completionTemplates.map(t => t.id),
    [configRecord, completionTemplates]
  );
  const requiredTemplates = useMemo(
    () => completionTemplates.filter(t => requiredIds.includes(t.id)),
    [completionTemplates, requiredIds]
  );

  // Submissions for the selected date only
  const daySubs = useMemo(
    () => submissions.filter(s => dayKey(s.submission_date || s.created_date) === selectedDate),
    [submissions, selectedDate]
  );

  // Store managers only see the stores linked to their account
  const scopedStores = useMemo(
    () => isStoreManager
      ? stores.filter(s => assignedStores.includes(s.store_name))
      : stores,
    [stores, isStoreManager, assignedStores]
  );

  // Per-store completion rows
  const rows = useMemo(() => {
    return scopedStores.map(store => {
      const applicable = requiredTemplates.filter(t => templateAppliesToStore(t, store.store_name));
      const storeDaySubs = daySubs.filter(s => s.brand?.includes(store.store_name));
      const doneIds = new Set(storeDaySubs.map(s => s.template_id));
      const completed = applicable.filter(t => doneIds.has(t.id));
      const rate = applicable.length > 0 ? Math.round((completed.length / applicable.length) * 100) : 0;
      const missing = applicable.filter(t => !doneIds.has(t.id));
      return {
        store,
        required: applicable.length,
        completed: completed.length,
        rate,
        missing: missing.map(t => t.title),
      };
    }).filter(r => r.required > 0); // hide stores with no required checklists that day
  }, [scopedStores, requiredTemplates, daySubs]);

  // Sort: incomplete first, then by rate ascending — worst performers on top
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.rate - b.rate),
    [rows]
  );

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const done = rows.filter(r => r.rate >= PASS_THRESHOLD).length;
    const notStarted = rows.filter(r => r.completed === 0).length;
    const avg = Math.round(rows.reduce((s, r) => s + r.rate, 0) / rows.length);
    return { total: rows.length, done, notStarted, avg };
  }, [rows]);

  const handleExport = () => {
    const sheets = [
      {
        name: 'Daily Summary',
        title: `Daily Checklist Completion — ${formatPHDate(selectedDate)}`,
        headers: ['Store', 'Required', 'Completed', 'Rate %', 'Status', 'Missing Checklists'],
        rows: sortedRows.map(r => [
          r.store.store_name, r.required, r.completed, r.rate,
          r.rate >= PASS_THRESHOLD ? 'COMPLETE' : (r.completed === 0 ? 'NOT STARTED' : 'IN PROGRESS'),
          r.missing.join(' | '),
        ]),
      },
    ];
    exportSheetsToExcel(`Daily_Summary_${selectedDate}`, sheets);
  };

  if (!user) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-[#1fd655]" /></div>;

  if (!canAccess) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-400">The daily summary is only available to admins and store managers.</p>
    </div>
  );

  const loading = loadingTemplates || loadingStores || loadingSubs;

  return (
    <div className="app-page app-page-narrow">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Checklist monitoring</p>
          <div>
            <h1 className="app-page-heading">Daily summary</h1>
            <p className="app-page-description">
              {isStoreManager ? `Checklist completion for ${assignedStores.length} linked store${assignedStores.length !== 1 ? 's' : ''}` : 'Checklist completion across all stores'}
            </p>
        </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value || today)}
              className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-[#1fd655] focus:outline-none sm:h-auto sm:flex-none sm:px-2 sm:py-1.5"
            />
          </div>
          <ExcelExportButton onClick={handleExport} disabled={loading || rows.length === 0} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : !summary ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No stores with required checklists found.</p>
            <p className="text-slate-400 text-sm mt-1">Assign store-restricted audit templates to see completion here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Stores Tracked</p>
                <p className="text-3xl font-extrabold text-slate-900">{summary.total}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Fully Complete</p>
                <p className="text-3xl font-extrabold text-green-600">{summary.done}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Not Started</p>
                <p className="text-3xl font-extrabold text-red-600">{summary.notStarted}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overall Rate</p>
                <p className={`text-3xl font-extrabold ${summary.avg >= 75 ? 'text-green-600' : 'text-red-600'}`}>{summary.avg}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Store table */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
              <p className="font-bold text-slate-800 flex items-center gap-2">
                <Store className="w-4 h-4 text-[#1fd655]" /> Store Completion — {formatPHDate(selectedDate)}
              </p>
              <p className="text-xs text-slate-400">{requiredTemplates.length} required checklist{requiredTemplates.length !== 1 ? 's' : ''}</p>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              <div className="space-y-3 px-4 md:hidden">
                {sortedRows.map((r) => {
                  const complete = r.rate >= PASS_THRESHOLD;
                  return (
                    <article key={r.store.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div><h3 className="font-semibold text-slate-900">{r.store.store_name}</h3>{r.store.location && <p className="mt-0.5 text-xs text-slate-400">{r.store.location}</p>}</div>
                        <Badge className={complete ? 'border-green-200 bg-green-100 text-green-700' : r.completed === 0 ? 'border-red-200 bg-red-100 text-red-700' : 'border-amber-200 bg-amber-100 text-amber-700'}>{complete ? 'Complete' : r.completed === 0 ? 'Not started' : 'In progress'}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                        <div><p className="text-xs text-slate-500">Completed</p><p className="mt-1 font-semibold text-slate-800">{r.completed} / {r.required}</p></div>
                        <div><p className="text-xs text-slate-500">Completion rate</p><p className={`mt-1 font-bold ${complete ? 'text-green-600' : r.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{r.rate}%</p></div>
                      </div>
                      {r.missing.length > 0 && <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Missing</p><p className="mt-1 text-xs leading-5 text-slate-600">{r.missing.join(' · ')}</p></div>}
                    </article>
                  );
                })}
                {sortedRows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No stores with required checklists for this date.</p>}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Store</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Completed</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Rate</th>
                      <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Missing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r, i) => {
                      const complete = r.rate >= PASS_THRESHOLD;
                      return (
                        <tr key={r.store.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                          <td className="px-5 py-3 font-medium text-slate-800">
                            {r.store.store_name}
                            {r.store.location && <span className="block text-xs text-slate-400">{r.store.location}</span>}
                          </td>
                          <td className="text-center px-3 py-3 text-slate-700">
                            <span className="inline-flex items-center gap-1.5">
                              {complete
                                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                : r.completed === 0 ? <XCircle className="w-4 h-4 text-red-400" /> : null}
                              {r.completed} / {r.required}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`font-bold ${r.rate >= PASS_THRESHOLD ? 'text-green-600' : r.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {r.rate}%
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            <Badge className={complete ? 'bg-green-100 text-green-700 border-green-200' : r.completed === 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                              {complete ? 'COMPLETE' : r.completed === 0 ? 'NOT STARTED' : 'IN PROGRESS'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">
                            {r.missing.length > 0
                              ? <span className="line-clamp-2">{r.missing.join(' · ')}</span>
                              : <span className="text-green-500 font-medium">All done ✅</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {sortedRows.length === 0 && (
                      <tr><td colSpan={5} className="text-center px-5 py-10 text-slate-400 text-sm">No stores with required checklists for this date.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
