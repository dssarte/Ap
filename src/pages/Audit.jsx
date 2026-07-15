import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import SignaturePad from '@/components/audit/SignaturePad';
import CameraCapture from '@/components/audit/CameraCapture';
import PhotoThumb from '@/components/audit/PhotoThumb';
import { useDraftStorage } from '@/hooks/useAuditDraft';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList, CheckCircle2, Eye, ChevronLeft, Trash2, Pencil, FileText, Camera, History } from "lucide-react";
import jsPDF from 'jspdf';
import moment from 'moment';
import { formatPHDateTime, formatPHDateShort } from '@/lib/dateUtils';
import { getLocation } from '@/lib/getLocation';
import { compressImage } from '@/lib/compressImage';

function formatTimeLabel(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function isTemplateAvailableNow(t) {
  if (!t.has_time_restriction || !t.available_from_time || !t.available_to_time) return true;
  const now = moment().utcOffset(8);
  const nowMinutes = now.hours() * 60 + now.minutes();
  const [fh, fm] = t.available_from_time.split(':').map(Number);
  const [th, tm] = t.available_to_time.split(':').map(Number);
  const fromMinutes = fh * 60 + fm;
  const toMinutes = th * 60 + tm;
  if (fromMinutes === toMinutes) return true;
  if (fromMinutes < toMinutes) {
    return nowMinutes >= fromMinutes && nowMinutes <= toMinutes;
  }
  return nowMinutes >= fromMinutes || nowMinutes <= toMinutes;
}

// Returns the start (moment) of the current daily cycle for a template, based on its availability window.
// For templates without a time restriction, the cycle is simply the calendar day (midnight to midnight).
function getCurrentCycleStart(t) {
  const now = moment().utcOffset(8);
  if (!t.has_time_restriction || !t.available_from_time || !t.available_to_time) {
    return now.clone().startOf('day');
  }
  const nowMinutes = now.hours() * 60 + now.minutes();
  const [fh, fm] = t.available_from_time.split(':').map(Number);
  const [th, tm] = t.available_to_time.split(':').map(Number);
  const fromMinutes = fh * 60 + fm;
  const toMinutes = th * 60 + tm;
  const todayFrom = now.clone().startOf('day').add(fromMinutes, 'minutes');
  if (fromMinutes <= toMinutes) {
    // Same-day window
    return todayFrom;
  }
  // Crosses midnight: if we're past the from-time, the cycle started today; otherwise it started yesterday
  return nowMinutes >= fromMinutes ? todayFrom : todayFrom.clone().subtract(1, 'day');
}

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6979737791aaf996d5335e29/016378777_TheFigaroCoffeeGroup_logo.png";

const isHeicUrl = (url = '') => /\.heic($|\?)/i.test(url);

async function fetchImageBase64(url) {
  // HEIC cannot be decoded by jsPDF — skip to avoid crashing the export.
  if (isHeicUrl(url)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
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

export default function Audit() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'fill' | 'history' | 'detail'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyStoreFilter, setHistoryStoreFilter] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.user_type === 'admin';
  // Effective stores: store managers aggregate across all assigned stores; others use their single store
  const effectiveStores = isAdmin
    ? []
    : user?.user_type === 'store_manager'
      ? (user.assigned_stores || [])
      : (user?.store_name ? [user.store_name] : []);

  const { data: allTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['audit-templates-active'],
    queryFn: () => base44.entities.AuditTemplate.filter({ is_active: true }, '-created_date', 100),
    enabled: !!user,
  });

  // Admins see all templates
  // Templates with store_restrictions (or legacy store_name): only users from those stores can see them
  // Templates with no restrictions: visible to all QA users
  const templates = isAdmin
    ? allTemplates
    : allTemplates.filter(t => {
        const restrictions = t.store_restrictions?.length > 0
          ? t.store_restrictions
          : t.store_name ? [{ store_name: t.store_name }] : [];

        if (restrictions.length > 0) {
          // Store-restricted: user's store must match at least one restriction (any assigned store for store managers)
          return restrictions.some(r => effectiveStores.includes(r.store_name));
        } else {
          // No restriction: only visible to QA department or admin users
          return user?.department_name === 'Quality Assurance';
        }
      });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
    enabled: !!user,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-active'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'store_name', 200),
    enabled: !!user,
  });

  const { data: allSubmissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ['audit-submissions'],
    queryFn: () => base44.entities.AuditSubmission.list('-created_date', 200),
    enabled: !!user,
  });

  // Admins see all submissions
  // Store managers see submissions from all their assigned stores (aggregated as one)
  // Everyone else only sees their own submissions
  const submissions = isAdmin
    ? allSubmissions
    : user?.user_type === 'store_manager'
      ? allSubmissions.filter(sub => effectiveStores.some(name => sub.brand?.includes(name)))
      : allSubmissions.filter(sub => sub.submitted_by_email === user?.email);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AuditSubmission.delete(id),
    onSuccess: () => qc.invalidateQueries(['audit-submissions']),
  });

  // For store-locked users, a template is "done for today" if their store already has a submission
  // within the current availability cycle — one checklist per store per day.
  const isDoneForCycle = (t) => {
    if (effectiveStores.length === 0) return false;
    const cycleStart = getCurrentCycleStart(t);
    // A template is "done for today" only when every store the user manages has submitted within the current cycle
    return effectiveStores.every(storeName =>
      allSubmissions.some(s => {
        if (s.template_id !== t.id || !s.brand?.includes(storeName)) return false;
        // Entity timestamps come back without a trailing "Z", which gets misread as local time — force UTC parsing.
        const created = /Z$|[+-]\d{2}:?\d{2}$/.test(s.created_date) ? s.created_date : s.created_date + 'Z';
        return moment(created).isSameOrAfter(cycleStart);
      })
    );
  };

  const startAudit = (template) => {
    if (!isTemplateAvailableNow(template) || isDoneForCycle(template)) return;
    setSelectedTemplate(template);
    setView('fill');
  };

  const viewSubmission = (sub) => {
    setSelectedSubmission(sub);
    setView('detail');
  };

  const editSubmission = (e, sub) => {
    e.stopPropagation();
    setSelectedSubmission(sub);
    setSelectedTemplate(templates.find(t => t.id === sub.template_id) || { id: sub.template_id, title: sub.template_title, sections: [] });
    setView('edit');
  };

  const deleteSubmission = (e, id) => {
    e.stopPropagation();
    if (confirm('Delete this audit submission?')) deleteMutation.mutate(id);
  };

  if (!user) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#1fd655]" /></div>;

  const titleMap = { list: 'Audit', history: 'Audit History', fill: selectedTemplate?.title, edit: selectedSubmission?.template_title, detail: selectedSubmission?.template_title };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {view !== 'list' && view !== 'history' && (
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-slate-500" onClick={() => setView(view === 'fill' ? 'list' : 'history')}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {(view === 'history') && (
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-slate-500" onClick={() => setView('list')}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1fd655] flex items-center justify-center shadow-md">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            {titleMap[view] || 'Audit'}
          </h1>
          {view === 'list' && <p className="text-slate-500 mt-1 ml-14">Select a checklist to start an audit</p>}
        </div>
        {view === 'list' && (
          <Button variant="outline" onClick={() => setView('history')} className="gap-2">
            <Eye className="w-4 h-4" /> History
          </Button>
        )}
      </div>

      {/* TEMPLATE LIST */}
      {view === 'list' && (
        loadingTemplates ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : templates.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-200">
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">
                {isAdmin ? 'No audit templates available yet.' : 'No audit templates assigned to you yet.'}
              </p>
              {!isAdmin && <p className="text-slate-400 text-sm mt-1">Please contact your admin to assign an audit form.</p>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {templates.map(t => {
              const doneForCycle = isDoneForCycle(t);
              const available = isTemplateAvailableNow(t) && !doneForCycle;
              return (
                <Card
                  key={t.id}
                  className={`border-2 border-slate-200 shadow-sm transition-all ${available ? 'hover:shadow-md hover:border-[#1fd655]/50 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                  onClick={() => startAudit(t)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1fd655]/10 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-6 h-6 text-[#1fd655]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900">{t.title}</p>
                      {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                      <p className="text-xs text-slate-400 mt-1">
                        {t.sections?.length || 0} sections · {t.sections?.reduce((s, sec) => s + (sec.items?.length || 0), 0)} items
                      </p>
                      {doneForCycle ? (
                        <p className="text-xs mt-1 font-medium text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done for today
                        </p>
                      ) : t.has_time_restriction && t.available_from_time && t.available_to_time && (
                        <p className={`text-xs mt-1 font-medium ${available ? 'text-amber-600' : 'text-red-500'}`}>
                          ⏰ {formatTimeLabel(t.available_from_time)} – {formatTimeLabel(t.available_to_time)}{t.available_to_time < t.available_from_time ? ' next day' : ''}
                        </p>
                      )}
                    </div>
                    <Button size="sm" disabled={!available} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold flex-shrink-0 disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-400">
                      {doneForCycle ? 'Done' : available ? 'Start' : 'Unavailable'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* HISTORY */}
      {view === 'history' && (
        <>
          {/* Date range + store filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-600">Date Range:</span>
            <input
              type="date"
              value={historyDateFrom}
              onChange={e => setHistoryDateFrom(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
            />
            <span className="text-slate-400 text-sm">–</span>
            <input
              type="date"
              value={historyDateTo}
              onChange={e => setHistoryDateTo(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
            />
            {effectiveStores.length > 1 && (
              <>
                <span className="text-sm font-semibold text-slate-600 ml-2">Store:</span>
                <Select value={historyStoreFilter} onValueChange={setHistoryStoreFilter}>
                  <SelectTrigger className="w-48 h-8 text-sm">
                    <SelectValue placeholder="All stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All stores</SelectItem>
                    {effectiveStores.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {!historyDateFrom || !historyDateTo ? (
            <Card className="border-2 border-dashed border-slate-200">
              <CardContent className="py-16 text-center">
                <p className="text-slate-400">Please select a date range to view audit history.</p>
              </CardContent>
            </Card>
          ) : loadingSubmissions ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (() => {
            const filtered = submissions.filter(sub => {
              const d = new Date(sub.submission_date || sub.created_date);
              // Parse date strings as PHT (UTC+8) by appending the local offset
              const from = new Date(`${historyDateFrom}T00:00:00+08:00`);
              const to = new Date(`${historyDateTo}T23:59:59+08:00`);
              const inRange = d >= from && d <= to;
              const matchesStore = !historyStoreFilter || (sub.brand || '').includes(historyStoreFilter);
              return inRange && matchesStore;
            });
            return filtered.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-200">
                <CardContent className="py-16 text-center">
                  <p className="text-slate-400">No audit submissions found for the selected date range.</p>
                </CardContent>
              </Card>
            ) : (
          <div className="space-y-3">
            {filtered.map(sub => (
              <Card key={sub.id} className="border-2 border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => viewSubmission(sub)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{sub.template_title}</p>
                    <p className="text-xs text-slate-500">
                      {sub.brand && <span className="mr-2">📍 {sub.brand}</span>}
                      By {sub.submitted_by_name || sub.submitted_by_email} · {formatPHDateTime(sub.submission_date || sub.created_date)}
                    </p>
                  </div>
                  <ScoreBadge score={sub.score} />
                  <div className="text-xs text-slate-400 text-right hidden sm:block">
                    <p className="text-green-600 font-semibold">✓ {sub.yes_count} YES</p>
                    <p className="text-red-500 font-semibold">✗ {sub.no_count} NO</p>
                    <p className="text-slate-400">— {sub.na_count} N/A</p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={(e) => editSubmission(e, sub)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={(e) => deleteSubmission(e, sub.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
            );
          })()}
        </>
      )}

      {/* FILL FORM (new) */}
      {view === 'fill' && selectedTemplate && (
        <AuditFillForm
          template={selectedTemplate}
          user={user}
          brands={brands}
          stores={stores}
          onDone={() => { qc.invalidateQueries(['audit-submissions']); qc.invalidateQueries(['audit-submissions-all']); setView('history'); }}
          onCancel={() => setView('list')}
        />
      )}

      {/* EDIT FORM (existing submission) */}
      {view === 'edit' && selectedSubmission && selectedTemplate && (
        <AuditFillForm
          template={selectedTemplate}
          user={user}
          brands={brands}
          stores={stores}
          existingSubmission={selectedSubmission}
          onDone={() => { qc.invalidateQueries(['audit-submissions']); qc.invalidateQueries(['audit-submissions-all']); setView('history'); }}
          onCancel={() => setView('history')}
        />
      )}

      {/* SUBMISSION DETAIL */}
      {view === 'detail' && selectedSubmission && (
        <SubmissionDetail submission={selectedSubmission} templates={templates} user={user} />
      )}
    </div>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return null;
  const color = score >= 80 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <Badge className={`${color} border-0 font-bold text-base px-3 py-1`}>{score}%</Badge>;
}

function AuditFillForm({ template, user, brands, stores, existingSubmission, onDone, onCancel }) {
  // If user has a store_name, auto-resolve their brand/store and lock it
  const userStore = user?.store_name ? stores.find(s => s.store_name === user.store_name) : null;
  const userBrandId = userStore?.brand_id || '';
  const isStoreLocked = !!userStore;

  // Parse existing brand back into brandId + storeId if editing
  const [selectedBrandId, setSelectedBrandId] = useState(() => {
    if (userBrandId) return userBrandId;
    if (!existingSubmission?.brand) return '';
    const found = brands.find(b => existingSubmission.brand.startsWith(b.brand_name));
    return found?.id || '';
  });
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    if (userStore) return userStore.id;
    if (!existingSubmission?.brand) return '';
    const found = stores.find(s => existingSubmission.brand.includes(s.store_name));
    return found?.id || '';
  });

  const filteredStores = stores.filter(s => s.brand_id === selectedBrandId);
  const selectedBrand = brands.find(b => b.id === selectedBrandId);
  const selectedStore = stores.find(s => s.id === selectedStoreId);
  const brand = selectedBrand && selectedStore
    ? `${selectedBrand.brand_name} - ${selectedStore.store_name}${selectedStore.location ? `, ${selectedStore.location}` : ''}`
    : '';
  const [answers, setAnswers] = useState(existingSubmission?.answers || {});
  const [noComments, setNoComments] = useState(existingSubmission?.no_comments || {});
  const [itemPhotos, setItemPhotos] = useState(existingSubmission?.item_photos || {});
  const [uploadingItemPhoto, setUploadingItemPhoto] = useState(null);
  const [others, setOthers] = useState(existingSubmission?.others || '');
  const [concernsRecs, setConcernsRecs] = useState(existingSubmission?.concerns_recommendations || '');
  const [deviationsPhotos, setDeviationsPhotos] = useState(existingSubmission?.deviations_photo_urls || []);
  const [updates, setUpdates] = useState(existingSubmission?.updates || '');
  const [updatesAttachments, setUpdatesAttachments] = useState(existingSubmission?.updates_attachment_urls || []);
  const [uploadingDeviations, setUploadingDeviations] = useState(false);
  const [uploadingUpdates, setUploadingUpdates] = useState(false);
  const [sig1Photo, setSig1Photo] = useState(existingSubmission?.signature1_photo_url || '');
  const [sig1Name, setSig1Name] = useState(existingSubmission?.signature1_name || '');
  const [sig1Position, setSig1Position] = useState(existingSubmission?.signature1_position || '');
  const [sig2Photo, setSig2Photo] = useState(existingSubmission?.signature2_photo_url || '');
  const [sig2Name, setSig2Name] = useState(existingSubmission?.signature2_name || '');
  const [sig2Position, setSig2Position] = useState(existingSubmission?.signature2_position || '');
  const [submissionDate, setSubmissionDate] = useState(() =>
    moment(existingSubmission?.submission_date || existingSubmission?.created_date || new Date()).utcOffset(8).format('YYYY-MM-DD')
  );
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.user_type === 'admin';

  // Draft autosave/restore — survives accidental close/navigation
  const draftKey = `audit_draft_${template.id}_${user.email}${existingSubmission?.id ? `_edit_${existingSubmission.id}` : ''}`;
  const { saveDraft, loadDraft, clearDraft } = useDraftStorage(draftKey);
  const [pendingDraft, setPendingDraft] = useState(null);

  useEffect(() => {
    if (existingSubmission) return; // editing saved submission — don't override
    const draft = loadDraft();
    if (!draft) return;
    const hasContent =
      (draft.answers && Object.keys(draft.answers).length > 0) ||
      (draft.noComments && Object.keys(draft.noComments).length > 0) ||
      (draft.itemPhotos && Object.keys(draft.itemPhotos).length > 0) ||
      !!draft.others?.trim() || !!draft.concernsRecs?.trim() || !!draft.updates?.trim() ||
      (draft.deviationsPhotos?.length > 0) || (draft.updatesAttachments?.length > 0) ||
      !!draft.sig1Name?.trim() || !!draft.sig1Position?.trim() || !!draft.sig2Name?.trim() || !!draft.sig2Position?.trim();
    if (hasContent) setPendingDraft(draft);
  }, []);  

  const draftSnapshot = {
    selectedBrandId, selectedStoreId, answers, noComments, itemPhotos,
    others, concernsRecs, deviationsPhotos, updates, updatesAttachments,
    sig1Photo, sig1Name, sig1Position, sig2Photo, sig2Name, sig2Position,
  };
  const hasProgress = useMemo(() =>
    Object.keys(answers).length > 0 ||
    Object.keys(noComments).length > 0 ||
    Object.keys(itemPhotos).length > 0 ||
    !!others.trim() || !!concernsRecs.trim() || !!updates.trim() ||
    deviationsPhotos.length > 0 || updatesAttachments.length > 0 ||
    !!sig1Name.trim() || !!sig1Position.trim() || !!sig2Name.trim() || !!sig2Position.trim(),
    [answers, noComments, itemPhotos, others, concernsRecs, updates, deviationsPhotos, updatesAttachments, sig1Name, sig1Position, sig2Name, sig2Position]
  );
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasProgress) saveDraft(draftSnapshot);
    }, 1000);
    return () => clearTimeout(t);
  });  

  const restoreDraft = () => {
    if (!pendingDraft) return;
    if (pendingDraft.selectedBrandId && !isStoreLocked) setSelectedBrandId(pendingDraft.selectedBrandId);
    if (pendingDraft.selectedStoreId && !isStoreLocked) setSelectedStoreId(pendingDraft.selectedStoreId);
    if (pendingDraft.answers) setAnswers(pendingDraft.answers);
    if (pendingDraft.noComments) setNoComments(pendingDraft.noComments);
    if (pendingDraft.itemPhotos) setItemPhotos(pendingDraft.itemPhotos);
    if (pendingDraft.others != null) setOthers(pendingDraft.others);
    if (pendingDraft.concernsRecs != null) setConcernsRecs(pendingDraft.concernsRecs);
    if (pendingDraft.deviationsPhotos) setDeviationsPhotos(pendingDraft.deviationsPhotos);
    if (pendingDraft.updates != null) setUpdates(pendingDraft.updates);
    if (pendingDraft.updatesAttachments) setUpdatesAttachments(pendingDraft.updatesAttachments);
    if (pendingDraft.sig1Photo) setSig1Photo(pendingDraft.sig1Photo);
    if (pendingDraft.sig1Name != null) setSig1Name(pendingDraft.sig1Name);
    if (pendingDraft.sig1Position != null) setSig1Position(pendingDraft.sig1Position);
    if (pendingDraft.sig2Photo) setSig2Photo(pendingDraft.sig2Photo);
    if (pendingDraft.sig2Name != null) setSig2Name(pendingDraft.sig2Name);
    if (pendingDraft.sig2Position != null) setSig2Position(pendingDraft.sig2Position);
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearDraft();
    setPendingDraft(null);
  };

  const uploadMultiplePhotos = async (files, setter, setUploading) => {
    setUploading(true);
    const urls = await Promise.all(
      Array.from(files).map(async (file) => {
        const compressed = await compressImage(file);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
        return file_url;
      })
    );
    setter(prev => [...prev, ...urls]);
    setUploading(false);
  };

  const removePhoto = (setter, index) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const uploadItemPhotos = async (itemId, files) => {
    setUploadingItemPhoto(itemId);
    // Only one photo is allowed per line item — a new upload replaces any existing one.
    const file = Array.from(files)[0];
    const compressed = await compressImage(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
    setItemPhotos(prev => ({ ...prev, [itemId]: [file_url] }));
    setUploadingItemPhoto(null);
  };

  const removeItemPhoto = (itemId, index) => {
    setItemPhotos(prev => ({ ...prev, [itemId]: (prev[itemId] || []).filter((_, i) => i !== index) }));
  }

  // Real-time camera capture target: { type: 'item'|'deviations'|'updates', itemId? }
  const [cameraTarget, setCameraTarget] = useState(null);

  const handleCameraCapture = async (file) => {
    const target = cameraTarget;
    setCameraTarget(null);
    if (!file) return;
    if (target?.type === 'item' && target.itemId) {
      await uploadItemPhotos(target.itemId, [file]);
    } else if (target?.type === 'deviations') {
      await uploadMultiplePhotos([file], setDeviationsPhotos, setUploadingDeviations);
    } else if (target?.type === 'updates') {
      await uploadMultiplePhotos([file], setUpdatesAttachments, setUploadingUpdates);
    }
  };;

  const allItems = template.sections?.flatMap(s => s.items || []) || [];

  const setAnswer = (itemId, val) => {
    setAnswers(a => ({ ...a, [itemId]: a[itemId] === val ? undefined : val }));
    // Clear NO comment if toggling away from NO
    if (val !== 'NO') setNoComments(c => { const n = { ...c }; delete n[itemId]; return n; });
  };

  const [photoError, setPhotoError] = useState('');
  const [errorItemId, setErrorItemId] = useState(null);

  const scrollToError = () => {
    if (!errorItemId) return;
    document.getElementById(`audit-item-${errorItemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async () => {
    if (!isStoreLocked && !brand) {
      setErrorItemId(null);
      setPhotoError('Please select a brand and store before submitting.');
      return;
    }
    const missingPhotoItem = allItems.find(it => it.photo_required && ['YES', 'NO'].includes(answers[it.id]) && !(itemPhotos[it.id]?.length > 0));
    if (missingPhotoItem) {
      setErrorItemId(missingPhotoItem.id);
      setPhotoError(`Please upload a photo for: "${missingPhotoItem.label}"`);
      return;
    }
    const missingReasonItem = allItems.find(it => answers[it.id] === 'NO' && !(noComments[it.id]?.trim()));
    if (missingReasonItem) {
      setErrorItemId(missingReasonItem.id);
      setPhotoError(`Please provide a reason for NO: "${missingReasonItem.label}"`);
      return;
    }
    if (!sig1Name.trim() || !sig1Position.trim()) {
      setErrorItemId(null);
      setPhotoError('Signature 1 name and position are required.');
      return;
    }
    setPhotoError('');
    setErrorItemId(null);
    setSaving(true);
    // Capture the submitter's location (reverse-geocoded to an address)
    const submitLocation = await getLocation().catch(() => null);
    const yes = allItems.filter(it => answers[it.id] === 'YES').length;
    const no = allItems.filter(it => answers[it.id] === 'NO').length;
    const na = allItems.filter(it => answers[it.id] === 'NA').length;
    const answered = yes + no;
    const score = answered > 0 ? Math.round((yes / answered) * 100) : 0;

    const payload = {
      template_id: template.id,
      template_title: template.title,
      submitted_by_email: user.email,
      submitted_by_name: user.display_name || user.full_name,
      brand: brand.trim(),
      location: existingSubmission?.id ? (existingSubmission.location || submitLocation || '') : (submitLocation || ''),
      answers,
      score,
      total_items: allItems.length,
      yes_count: yes,
      no_count: no,
      na_count: na,
      others: others.trim(),
      no_comments: noComments,
      item_photos: itemPhotos,
      concerns_recommendations: concernsRecs.trim(),
      deviations_photo_urls: deviationsPhotos,
      updates: updates.trim(),
      updates_attachment_urls: updatesAttachments,
      signature1_photo_url: sig1Photo,
      signature1_name: sig1Name.trim(),
      signature1_position: sig1Position.trim(),
      signature2_photo_url: sig2Photo,
      signature2_name: sig2Name.trim(),
      signature2_position: sig2Position.trim(),
    };

    if (existingSubmission?.id && isAdmin) {
      payload.submission_date = moment(submissionDate, 'YYYY-MM-DD').utcOffset(8, true).startOf('day').add(12, 'hours').toISOString();
    }

    try {
      let savedSubmission;
      if (existingSubmission?.id) {
        savedSubmission = await base44.entities.AuditSubmission.update(existingSubmission.id, payload);
      } else {
        savedSubmission = await base44.entities.AuditSubmission.create({
          ...payload,
          submission_date: new Date().toISOString(),
          created_by: user.email,
        });

        // Local Supabase replacement for the old Base44 audit automation.
        // Create one approved/open ticket for every audit section containing NO answers.
        if (template.active_ticket && no > 0) {
          const departments = await base44.entities.Department.filter({ is_active: true });
          const categories = await base44.entities.Category.filter({ is_active: true });
          for (const section of (template.sections || [])) {
            const failedItems = (section.items || []).filter(item => answers[item.id] === 'NO');
            if (!failedItems.length) continue;
            const dept = departments.find(d => (d.name || '').trim().toLowerCase() === (section.title || '').trim().toLowerCase());
            const category = categories.find(c => c.department_id === dept?.id && !c.is_audit_only) || categories.find(c => !c.is_audit_only && (c.name || '').toLowerCase().includes((section.title || '').toLowerCase()));
            const approver = dept ? await base44.functions.invoke('findApproverForDepartment', { department_id: dept.id }) : { data: {} };
            const details = failedItems.map(item => `- ${item.label}: ${noComments[item.id] || 'No reason provided'}`).join('\n');
            const ticket = await base44.entities.Ticket.create({
              title: `Audit NO - ${section.title} (${brand})`,
              description: `Auto-generated from audit ${template.title}.\n\n${details}`,
              department_id: dept?.id || user.department_id || '',
              department_name: dept?.name || section.title || user.department_name || '',
              handling_department_id: dept?.id || user.department_id || '',
              handling_department_name: dept?.name || section.title || user.department_name || '',
              category_id: category?.id || '',
              category_name: category?.name || 'Audit Concern',
              priority: 'high',
              image_urls: failedItems.flatMap(item => itemPhotos[item.id] || []),
              attachment_url: '',
              submitter_email: user.email,
              submitter_name: user.display_name || user.full_name,
              store_name: selectedStore?.store_name || user.store_name || '',
              status: 'open', approval_status: 'approved', approved_at: new Date().toISOString(),
              approver_email: approver.data?.approver_email || '',
              approver_name: approver.data?.approver_name || '',
              audit_submission_id: savedSubmission.id,
              audit_template_id: template.id,
              handling_history: [], escalated: false,
              sla_response_breached: false, sla_resolution_breached: false,
            });
            await base44.functions.invoke('calculateSLA', { ticket_id: ticket.id });
            await base44.functions.invoke('sendTicketNotification', { ticket_id: ticket.id, type: 'created', message: `Audit concern created: ${ticket.title}` });
          }
        }
      }
      clearDraft();
      onDone();
    } catch (err) {
      console.error('Audit submission failed:', err);
      setPhotoError(`Failed to save audit: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const answered = allItems.filter(it => answers[it.id]).length;
  const progress = allItems.length > 0 ? Math.round((answered / allItems.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Draft restore prompt */}
      {pendingDraft && (
        <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <History className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Unsaved audit draft found</p>
              <p className="text-sm text-amber-700">
                You have an in-progress audit from {pendingDraft._savedAt ? new Date(pendingDraft._savedAt).toLocaleString() : 'earlier'}. Restore it to continue where you left off, or discard to start fresh.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={discardDraft} className="border-amber-300 text-amber-800 hover:bg-amber-100">Discard</Button>
            <Button size="sm" onClick={restoreDraft} className="bg-amber-500 hover:bg-amber-600 text-white">Restore</Button>
          </div>
        </div>
      )}

      {/* Brand / Store selector */}
      <Card className="border-2 border-slate-200">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          {isStoreLocked ? (
            // User has a fixed store — show it as read-only
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Brand</p>
                <p className="font-semibold text-slate-900">{brands.find(b => b.id === userBrandId)?.brand_name || '-'}</p>
              </div>
              <div className="text-slate-300">·</div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Store</p>
                <p className="font-semibold text-slate-900">{userStore.store_name}{userStore.location ? `, ${userStore.location}` : ''}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Brand:</label>
                <Select value={selectedBrandId} onValueChange={(val) => { setSelectedBrandId(val); setSelectedStoreId(''); }}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Select brand..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Store:</label>
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId} disabled={!selectedBrandId}>
                  <SelectTrigger className="w-56 h-9">
                    <SelectValue placeholder={selectedBrandId ? "Select store..." : "Select brand first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStores.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.store_name}{s.location ? `, ${s.location}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Admin-editable audit date */}
      {existingSubmission && isAdmin && (
        <Card className="border-2 border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Audit Date:</label>
            <input
              type="date"
              value={submissionDate}
              onChange={e => setSubmissionDate(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
            />
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-200 rounded-full h-2">
          <div className="bg-[#1fd655] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm font-semibold text-slate-600">{answered}/{allItems.length} answered</span>
      </div>

      {/* Sections */}
      {template.sections?.map(sec => (
        <Card key={sec.id} className="border-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1fd655]">{sec.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {(sec.items || []).map((item, idx) => (
              <div key={item.id} id={`audit-item-${item.id}`} className="py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-800 flex-1">{idx + 1}. {item.label}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {['YES', 'NO', 'NA'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAnswer(item.id, opt)}
                        className={`px-3 py-1 rounded-md text-xs font-bold border-2 transition-all ${
                          answers[item.id] === opt
                            ? opt === 'YES' ? 'bg-green-500 border-green-500 text-white'
                              : opt === 'NO' ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-slate-400 border-slate-400 text-white'
                            : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                        }`}
                      >
                        {opt === 'NA' ? 'N/A' : opt}
                      </button>
                    ))}
                  </div>
                </div>
                {answers[item.id] === 'NO' && (
                  <textarea
                    className="mt-2 w-full border border-red-200 bg-red-50 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-red-400 placeholder-red-300"
                    rows={2}
                    placeholder="Reason for NO..."
                    value={noComments[item.id] || ''}
                    onChange={e => setNoComments(c => ({ ...c, [item.id]: e.target.value }))}
                  />
                )}
                {item.photo_required && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className={`inline-flex items-center gap-2 ${uploadingItemPhoto === item.id ? 'pointer-events-none opacity-50' : 'cursor-pointer'} bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-300 transition-colors`}>
                        {uploadingItemPhoto === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (itemPhotos[item.id]?.length ? '+ Replace Photo' : '+ Add Photo')}
                        <input type="file" accept="image/jpeg,image/png,image/jpg" className="hidden"
                          onChange={e => e.target.files.length && uploadItemPhotos(item.id, e.target.files)} />
                      </label>
                      <button
                        type="button"
                        disabled={uploadingItemPhoto === item.id}
                        onClick={() => setCameraTarget({ type: 'item', itemId: item.id })}
                        className="inline-flex items-center gap-2 disabled:opacity-50 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-300 transition-colors"
                      >
                        {uploadingItemPhoto === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Camera className="w-3.5 h-3.5" /> Take Photo</>}
                      </button>
                    </div>
                    {(itemPhotos[item.id]?.length > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {itemPhotos[item.id].map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`Item photo ${i+1}`} className="h-20 w-20 object-cover rounded-md border border-slate-200" />
                            <button onClick={() => removeItemPhoto(item.id, i)}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Extra fields */}
      <Card className="border-2 border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-5">
          {/* Others */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Others</label>
            <textarea
              className="w-full border border-slate-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-[#1fd655]"
              rows={3}
              value={others}
              onChange={e => setOthers(e.target.value)}
            />
          </div>

          {/* Concerns and Recommendations */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Concerns and Recommendations</label>
            <textarea
              className="w-full border border-slate-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-[#1fd655]"
              rows={3}
              value={concernsRecs}
              onChange={e => setConcernsRecs(e.target.value)}
            />
          </div>

          {/* Deviations */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Deviations</label>
            <div className="flex items-center gap-2">
              <label className={`inline-flex items-center gap-2 ${uploadingDeviations ? 'pointer-events-none opacity-50' : 'cursor-pointer'} bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-md border border-slate-300 transition-colors`}>
                {uploadingDeviations ? <Loader2 className="w-4 h-4 animate-spin" /> : '+ Add Photos'}
                <input type="file" accept="image/jpeg,image/png,image/jpg" multiple className="hidden"
                  onChange={e => e.target.files.length && uploadMultiplePhotos(e.target.files, setDeviationsPhotos, setUploadingDeviations)} />
              </label>
              <button
                type="button"
                disabled={uploadingDeviations}
                onClick={() => setCameraTarget({ type: 'deviations' })}
                className="inline-flex items-center gap-2 disabled:opacity-50 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-md border border-slate-300 transition-colors"
              >
                {uploadingDeviations ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4" /> Take Photo</>}
              </button>
            </div>
            {deviationsPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {deviationsPhotos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Deviation ${i+1}`} className="h-24 w-24 object-cover rounded-md border border-slate-200" />
                    <button onClick={() => removePhoto(setDeviationsPhotos, i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Updates */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Updates</label>
            <textarea
              className="w-full border border-slate-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-[#1fd655]"
              rows={3}
              value={updates}
              onChange={e => setUpdates(e.target.value)}
            />
          </div>

          {/* Updates Attachment */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Updates Attachment</label>
            <div className="flex items-center gap-2">
              <label className={`inline-flex items-center gap-2 ${uploadingUpdates ? 'pointer-events-none opacity-50' : 'cursor-pointer'} bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-md border border-slate-300 transition-colors`}>
                {uploadingUpdates ? <Loader2 className="w-4 h-4 animate-spin" /> : '+ Add Photos'}
                <input type="file" accept="image/jpeg,image/png,image/jpg" multiple className="hidden"
                  onChange={e => e.target.files.length && uploadMultiplePhotos(e.target.files, setUpdatesAttachments, setUploadingUpdates)} />
              </label>
              <button
                type="button"
                disabled={uploadingUpdates}
                onClick={() => setCameraTarget({ type: 'updates' })}
                className="inline-flex items-center gap-2 disabled:opacity-50 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-md border border-slate-300 transition-colors"
              >
                {uploadingUpdates ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4" /> Take Photo</>}
              </button>
            </div>
            {updatesAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {updatesAttachments.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Update ${i+1}`} className="h-24 w-24 object-cover rounded-md border border-slate-200" />
                    <button onClick={() => removePhoto(setUpdatesAttachments, i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2 border-2 border-slate-200 rounded-lg p-4">
              <label className="text-sm font-semibold text-slate-700">Signature 1 <span className="text-red-500">*</span></label>
              <SignaturePad value={sig1Photo} onChange={setSig1Photo} />
              <Input placeholder="Enter your name here" value={sig1Name} onChange={e => setSig1Name(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Enter your position here" value={sig1Position} onChange={e => setSig1Position(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-2 border-2 border-slate-200 rounded-lg p-4">
              <label className="text-sm font-semibold text-slate-700">Signature 2 <span className="text-slate-400 text-xs font-normal">(optional)</span></label>
              <SignaturePad value={sig2Photo} onChange={setSig2Photo} />
              <Input placeholder="Enter your name here" value={sig2Name} onChange={e => setSig2Name(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Enter your position here" value={sig2Position} onChange={e => setSig2Position(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {photoError && (
        <p
          onClick={scrollToError}
          className={`text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-right ${errorItemId ? 'cursor-pointer hover:bg-red-100' : ''}`}
        >
          {photoError}
        </p>
      )}
      <div className="flex justify-end gap-3 pb-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={saving || answered === 0 || (!isStoreLocked && !brand)}
          className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-semibold gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {existingSubmission ? 'Update Audit' : 'Submit Audit'}
        </Button>
      </div>

      {cameraTarget && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraTarget(null)} />
      )}
    </div>
  );
}

function SubmissionDetail({ submission, templates, user }) {
  const template = templates.find(t => t.id === submission.template_id);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    setExportingPdf(true);
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

      // Accent top bar
      doc.setFillColor(31, 214, 85);
      doc.rect(0, 0, pageW, 3, 'F');

      // Header logos + title
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
      const deptLabel = (user?.department_name || 'QUALITY ASSURANCE').toUpperCase();
      doc.text(deptLabel, pageW / 2, y + 10.5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(submission.template_title?.toUpperCase() || 'AUDIT FORM', pageW / 2, y + 17, { align: 'center' });
      y += logoH + 5;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      // Summary row
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, 16, 2, 2, 'FD');

      const scoreColor = submission.score >= 80 ? [34, 197, 94] : submission.score >= 50 ? [234, 179, 8] : [239, 68, 68];
      doc.setFillColor(...scoreColor);
      doc.roundedRect(margin + 2, y + 2, 22, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${submission.score}%`, margin + 13, y + 9.5, { align: 'center' });

      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Submitted by', margin + 28, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(submission.submitted_by_name || submission.submitted_by_email || '-', margin + 28, y + 10);

      if (submission.brand) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text('Branch / Brand', margin + 75, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(submission.brand, margin + 75, y + 10);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text('Date', pageW - margin - 55, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(formatPHDateTime(submission.submission_date || submission.created_date), pageW - margin - 55, y + 10);

      // YES/NO/NA counts
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(34, 197, 94);
      doc.text(`YES: ${submission.yes_count}`, pageW - margin - 6, y + 5, { align: 'right' });
      doc.setTextColor(239, 68, 68);
      doc.text(`NO: ${submission.no_count}`, pageW - margin - 6, y + 10, { align: 'right' });
      doc.setTextColor(150, 150, 150);
      doc.text(`N/A: ${submission.na_count}`, pageW - margin - 6, y + 15, { align: 'right' });

      y += 20;

      // Location (where the audit was submitted)
      if (submission.location) {
        addPageIfNeeded(8);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('LOCATION', margin, y);
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const locWrapped = doc.splitTextToSize(submission.location, contentW - 20);
        doc.text(locWrapped, margin + 18, y);
        y += locWrapped.length * 4 + 4;
      }

      // Sections
      if (template?.sections) {
        for (const sec of template.sections) {
          addPageIfNeeded(12);
          doc.setFillColor(240, 253, 244);
          doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, 'F');
          doc.setDrawColor(187, 247, 208);
          doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, 'S');
          doc.setTextColor(22, 163, 74);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(sec.title?.toUpperCase() || '', margin + 3, y + 5.5);
          y += 10;

          for (const [idx, item] of (sec.items || []).entries()) {
            const ans = submission.answers?.[item.id];
            const rowH = 8;
            addPageIfNeeded(rowH + 2);

            const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
            doc.setFillColor(...bg);
            doc.rect(margin, y, contentW, rowH, 'F');
            doc.setDrawColor(230, 230, 230);
            doc.line(margin, y + rowH, margin + contentW, y + rowH);

            doc.setTextColor(60, 60, 60);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const label = `${idx + 1}. ${item.label}`;
            const wrappedLabel = doc.splitTextToSize(label, contentW - 25);
            doc.text(wrappedLabel, margin + 2, y + 5);

            // Answer badge
            if (ans) {
              const badgeColor = ans === 'YES' ? [220, 252, 231] : ans === 'NO' ? [254, 226, 226] : [241, 245, 249];
              const textColor = ans === 'YES' ? [22, 163, 74] : ans === 'NO' ? [220, 38, 38] : [100, 116, 139];
              doc.setFillColor(...badgeColor);
              doc.roundedRect(pageW - margin - 15, y + 1.5, 13, rowH - 3, 1.5, 1.5, 'F');
              doc.setTextColor(...textColor);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7);
              doc.text(ans === 'NA' ? 'N/A' : ans, pageW - margin - 8.5, y + 5.5, { align: 'center' });
            }

            y += rowH + (wrappedLabel.length > 1 ? (wrappedLabel.length - 1) * 3.5 : 0);

            // NO comment
            const noComment = submission.no_comments?.[item.id];
            if (ans === 'NO' && noComment) {
              addPageIfNeeded(6);
              doc.setFillColor(254, 242, 242);
              const commentWrapped = doc.splitTextToSize(`  >> ${noComment}`, contentW - 4);
              doc.rect(margin, y, contentW, commentWrapped.length * 4 + 2, 'F');
              doc.setTextColor(220, 38, 38);
              doc.setFont('helvetica', 'italic');
              doc.setFontSize(7);
              doc.text(commentWrapped, margin + 2, y + 3.5);
              y += commentWrapped.length * 4 + 4;
            }

            // Item photos
            const itemPhotoUrls = submission.item_photos?.[item.id];
            if (itemPhotoUrls?.length) {
              const imgW = 30, imgH = 22, gap = 3;
              addPageIfNeeded(imgH + 4);
              let px = margin + 2;
              for (const url of itemPhotoUrls) {
                if (px + imgW > pageW - margin) {
                  px = margin + 2;
                  y += imgH + gap;
                  addPageIfNeeded(imgH + 4);
                }
                const b64 = await fetchImageBase64(url);
                if (b64) {
                  try { doc.addImage(b64, 'JPEG', px, y, imgW, imgH); }
                  catch { /* unsupported format — leave blank slot */ }
                } else {
                  // Placeholder for missing/unsupported photo so the slot isn't invisible
                  doc.setFillColor(241, 245, 249);
                  doc.rect(px, y, imgW, imgH, 'F');
                  doc.setDrawColor(203, 213, 225);
                  doc.rect(px, y, imgW, imgH, 'S');
                  doc.setTextColor(148, 163, 184);
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(6);
                  doc.text(isHeicUrl(url) ? 'HEIC' : 'N/A', px + imgW / 2, y + imgH / 2, { align: 'center' });
                }
                px += imgW + gap;
              }
              y += imgH + 4;
            }
          }
          y += 4;
        }
      }

      // Extra fields
      const addTextField = (label, value) => {
        if (!value) return;
        addPageIfNeeded(14);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(label.toUpperCase(), margin, y + 4);
        y += 6;
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const wrapped = doc.splitTextToSize(value, contentW);
        doc.text(wrapped, margin, y + 4);
        y += wrapped.length * 4 + 4;
      };

      addTextField('Others', submission.others);
      addTextField('Concerns and Recommendations', submission.concerns_recommendations);
      addTextField('Updates', submission.updates);

      // Deviation photos
      const addPhotos = async (label, urls) => {
        if (!urls?.length) return;
        addPageIfNeeded(10);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(label.toUpperCase(), margin, y + 4);
        y += 8;
        const imgW = 42, imgH = 32, gap = 4;
        let x = margin;
        for (const url of urls) {
          addPageIfNeeded(imgH + 4);
          const b64 = await fetchImageBase64(url);
          if (b64) {
            try { doc.addImage(b64, 'JPEG', x, y, imgW, imgH); }
            catch { /* unsupported format — skip */ }
          }
          x += imgW + gap;
          if (x + imgW > pageW - margin) {
            x = margin;
            y += imgH + gap;
          }
        }
        if (x > margin) y += imgH + 6;
      };

      await addPhotos('Deviations', submission.deviations_photo_urls);
      await addPhotos('Updates Attachment', submission.updates_attachment_urls);

      // Signatures
      const hasSigs = submission.signature1_photo_url || submission.signature1_name || submission.signature2_photo_url || submission.signature2_name;
      if (hasSigs) {
        addPageIfNeeded(40);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('SIGNATURES', margin, y + 4);
        y += 8;

        const sigW = (contentW - 8) / 2;
        for (const [i, sig] of [
          { photo: submission.signature1_photo_url, name: submission.signature1_name, pos: submission.signature1_position },
          { photo: submission.signature2_photo_url, name: submission.signature2_name, pos: submission.signature2_position },
        ].entries()) {
          const sx = margin + i * (sigW + 8);
          doc.setDrawColor(200, 200, 200);
          doc.rect(sx, y, sigW, 36, 'S');
          if (sig.photo) {
            const b64 = await fetchImageBase64(sig.photo);
            if (b64) {
              try { doc.addImage(b64, 'PNG', sx + 2, y + 2, sigW - 4, 22); }
              catch { /* unsupported format — skip */ }
            }
          }
          doc.setTextColor(30, 30, 30);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(sig.name || '', sx + sigW / 2, y + 28, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(sig.pos || '', sx + sigW / 2, y + 33, { align: 'center' });
        }
        y += 42;
      }

      // Footer on every page: accent line, page numbers, generated timestamp
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageH - 8, pageW - margin, pageH - 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated ${formatPHDateTime(new Date())}`, margin, pageH - 4);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
      }

      const filename = `${submission.template_title || 'audit'}_${formatPHDateShort(submission.submission_date || submission.created_date)}.pdf`.replace(/\s+/g, '_').replace(/\//g, '-');
      doc.save(filename);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-2 border-slate-200">
        <CardContent className="p-5 flex flex-wrap gap-6 items-center">
          <ScoreBadge score={submission.score} />
          <div>
            <p className="text-xs text-slate-500">Submitted by</p>
            <p className="font-semibold text-slate-900">{submission.submitted_by_name || submission.submitted_by_email}</p>
          </div>
          {submission.brand && (
            <div>
              <p className="text-xs text-slate-500">Branch / Brand</p>
              <p className="font-semibold text-slate-900">{submission.brand}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">Date</p>
            <p className="font-semibold text-slate-900">{formatPHDateTime(submission.submission_date || submission.created_date)}</p>
          </div>
          {submission.location && (
            <div>
              <p className="text-xs text-slate-500">Location</p>
              <p className="font-semibold text-slate-900">{submission.location}</p>
            </div>
          )}
          <div className="flex gap-3 text-sm">
            <span className="text-green-600 font-bold">✓ {submission.yes_count} YES</span>
            <span className="text-red-500 font-bold">✗ {submission.no_count} NO</span>
            <span className="text-slate-400 font-bold">— {submission.na_count} N/A</span>
          </div>
          <div className="ml-auto">
            <Button onClick={handleExportPdf} disabled={exportingPdf} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-bold gap-2">
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {template?.sections?.map(sec => (
        <Card key={sec.id} className="border-2 border-slate-200">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1fd655]">{sec.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-1">
            {(sec.items || []).map((item, idx) => {
              const ans = submission.answers?.[item.id];
              const noComment = submission.no_comments?.[item.id];
              const photos = submission.item_photos?.[item.id];
              return (
                <div key={item.id} className="py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-800 flex-1">{idx + 1}. {item.label}</p>
                    <span className={`px-3 py-0.5 rounded-md text-xs font-bold flex-shrink-0 ${
                      ans === 'YES' ? 'bg-green-100 text-green-700'
                      : ans === 'NO' ? 'bg-red-100 text-red-700'
                      : ans === 'NA' ? 'bg-slate-100 text-slate-500'
                      : 'bg-slate-50 text-slate-300'
                    }`}>
                      {ans === 'NA' ? 'N/A' : (ans || '—')}
                    </span>
                  </div>
                  {ans === 'NO' && noComment && (
                    <p className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{noComment}</p>
                  )}
                  {photos?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {photos.map((url, i) => (
                        <PhotoThumb key={i} url={url} alt={`Item photo ${i+1}`} className="h-20 w-20 object-cover rounded-md border border-slate-200" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Extra fields detail */}
      <Card className="border-2 border-slate-200">
        <CardContent className="p-5 space-y-5">
          {submission.others && (
            <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Others</p><p className="text-sm text-slate-800 whitespace-pre-wrap">{submission.others}</p></div>
          )}
          {submission.concerns_recommendations && (
            <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Concerns and Recommendations</p><p className="text-sm text-slate-800 whitespace-pre-wrap">{submission.concerns_recommendations}</p></div>
          )}
          {submission.deviations_photo_urls?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Deviations</p>
              <div className="flex flex-wrap gap-2">
                {submission.deviations_photo_urls.map((url, i) => (
                  <PhotoThumb key={i} url={url} alt={`Deviation ${i+1}`} className="h-32 w-32 object-cover rounded-md border border-slate-200" />
                ))}
              </div>
            </div>
          )}
          {submission.updates && (
            <div><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Updates</p><p className="text-sm text-slate-800 whitespace-pre-wrap">{submission.updates}</p></div>
          )}
          {submission.updates_attachment_urls?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Updates Attachment</p>
              <div className="flex flex-wrap gap-2">
                {submission.updates_attachment_urls.map((url, i) => (
                  <PhotoThumb key={i} url={url} alt={`Update ${i+1}`} className="h-32 w-32 object-cover rounded-md border border-slate-200" />
                ))}
              </div>
            </div>
          )}
          {(submission.signature1_name || submission.signature1_photo_url || submission.signature2_name || submission.signature2_photo_url) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Signatures</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { label: 'Signature 1', photo: submission.signature1_photo_url, name: submission.signature1_name, pos: submission.signature1_position },
                  { label: 'Signature 2', photo: submission.signature2_photo_url, name: submission.signature2_name, pos: submission.signature2_position },
                ].map((sig, i) => (
                  <div key={i} className="border-2 border-slate-200 rounded-lg p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">{sig.label}</p>
                    {sig.photo && <PhotoThumb url={sig.photo} alt={sig.label} className="h-28 object-contain rounded border border-slate-200 bg-slate-50 w-full" />}
                    {sig.name && <p className="text-sm font-semibold text-slate-900">{sig.name}</p>}
                    {sig.pos && <p className="text-xs text-slate-500">{sig.pos}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}