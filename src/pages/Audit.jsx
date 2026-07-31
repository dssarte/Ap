import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import SignaturePad from '@/components/audit/SignaturePad';
import CameraCapture from '@/components/audit/CameraCapture';
import SubmissionDetail, { ScoreBadge } from '@/components/audit/SubmissionDetail';
import { useDraftStorage } from '@/hooks/useAuditDraft';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList, CheckCircle2, Eye, ChevronLeft, ChevronDown, Trash2, Pencil, Camera, History, ListChecks } from "lucide-react";
import moment from 'moment';
import { auditBusinessDayKey, formatPHDateTime } from '@/lib/dateUtils';
import { getLocation } from '@/lib/getLocation';
import { compressImage } from '@/lib/compressImage';
import { SectionLoadingSkeleton } from '@/components/PageState';

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

const LOGO_URL = '/assets/figaro-logo.png';

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

async function persistSignature(value, label) {
  if (!value || !value.startsWith('data:')) return value || '';
  const blob = await (await fetch(value)).blob();
  const file = new File([blob], `${label}_${Date.now()}.png`, { type: 'image/png' });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
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
    <div className="app-page app-page-narrow">
      {/* Header */}
      <div className="app-page-header">
        <div>
          {view !== 'list' && view !== 'history' && (
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-slate-500" onClick={() => {
              if (!window.confirm('Leave this audit? Your current progress is saved automatically as a draft.')) return;
              setView(view === 'fill' ? 'list' : 'history');
            }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {(view === 'history') && (
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-slate-500" onClick={() => setView('list')}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          <p className="app-page-eyebrow">Quality assurance</p>
          <h1 className="app-page-heading">{titleMap[view] || 'Audit'}</h1>
          {view === 'list' && <p className="app-page-description">Select a checklist to start an audit.</p>}
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
          <SectionLoadingSkeleton rows={4} label="Loading audit checklists" />
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
          <SectionLoadingSkeleton rows={4} label="Loading audit history" />
        ) : (() => {
            const filtered = submissions.filter(sub => {
              const businessDay = auditBusinessDayKey(sub);
              const inRange = businessDay >= historyDateFrom && businessDay <= historyDateTo;
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

function AuditFillForm({ template, user, brands, stores, existingSubmission, onDone, onCancel }) {
  const isStoreManager = user?.user_type === 'store_manager';
  const assignedStoreNames = new Set(
    (isStoreManager && Array.isArray(user?.assigned_stores) ? user.assigned_stores : [])
      .map(name => String(name).trim().toLowerCase())
  );
  const templateRestrictions = template?.store_restrictions?.length > 0
    ? template.store_restrictions
    : template?.store_name ? [{ store_name: template.store_name }] : [];
  const restrictedStoreNames = new Set(
    templateRestrictions.map(restriction => String(restriction.store_name || '').trim().toLowerCase())
  );

  // Store managers may only audit stores assigned to their account. When the
  // template has store restrictions, use the intersection of both scopes.
  // Other roles retain the existing unrestricted selector behavior.
  const selectableStores = isStoreManager
    ? stores.filter(store => {
        const normalizedName = String(store.store_name || '').trim().toLowerCase();
        return assignedStoreNames.has(normalizedName)
          && (restrictedStoreNames.size === 0 || restrictedStoreNames.has(normalizedName));
      })
    : stores;
  const selectableBrandIds = new Set(selectableStores.map(store => store.brand_id).filter(Boolean));
  const selectableBrands = isStoreManager
    ? brands.filter(brandRecord => selectableBrandIds.has(brandRecord.id))
    : brands;
  const soleSelectableStore = isStoreManager && selectableStores.length === 1
    ? selectableStores[0]
    : null;

  // If user has a store_name, auto-resolve their brand/store and lock it
  const userStore = !isStoreManager && user?.store_name
    ? stores.find(s => s.store_name === user.store_name)
    : null;
  const userBrandId = userStore?.brand_id || '';
  const isStoreLocked = !!userStore;

  // Parse existing brand back into brandId + storeId if editing
  const [selectedBrandId, setSelectedBrandId] = useState(() => {
    if (userBrandId) return userBrandId;
    if (soleSelectableStore) return soleSelectableStore.brand_id || '';
    if (!existingSubmission?.brand) return '';
    const found = selectableBrands.find(b => existingSubmission.brand.startsWith(b.brand_name));
    return found?.id || '';
  });
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    if (userStore) return userStore.id;
    if (soleSelectableStore) return soleSelectableStore.id;
    if (!existingSubmission?.brand) return '';
    const found = selectableStores.find(s => existingSubmission.brand.includes(s.store_name));
    return found?.id || '';
  });

  const filteredStores = selectableStores.filter(s => s.brand_id === selectedBrandId);
  const selectedBrand = selectableBrands.find(b => b.id === selectedBrandId);
  const selectedStore = selectableStores.find(s => s.id === selectedStoreId);
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
  // Only blocks brand-new submissions — an admin correcting an already-submitted
  // audit isn't creating a new late entry, so edits stay exempt from this check.
  const submissionWindowClosed = !existingSubmission && !isTemplateAvailableNow(template);

  // Draft autosave/restore — survives accidental close/navigation

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

  useEffect(() => {
    if (!hasProgress || saving) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasProgress, saving]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    if (pendingDraft.selectedBrandId && !isStoreLocked && selectableBrandIds.has(pendingDraft.selectedBrandId)) {
      setSelectedBrandId(pendingDraft.selectedBrandId);
    }
    if (pendingDraft.selectedStoreId && !isStoreLocked && selectableStores.some(store => store.id === pendingDraft.selectedStoreId)) {
      setSelectedStoreId(pendingDraft.selectedStoreId);
    }
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

  const uploadMultiplePhotos = async (files, setter, setUploading, currentCount = 0) => {
    const selected = Array.from(files);
    if (currentCount + selected.length > 10) {
      setPhotoError('Each audit photo section can contain up to 10 images.');
      return;
    }
    setUploading(true);
    setPhotoError('');
    try {
      const urls = await Promise.all(
        selected.map(async (file) => {
        const compressed = await compressImage(file);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
        return file_url;
        })
      );
      setter(prev => [...prev, ...urls]);
    } catch (error) {
      setPhotoError(error?.message || 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (setter, index) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const uploadItemPhotos = async (itemId, files) => {
    setUploadingItemPhoto(itemId);
    setPhotoError('');
    try {
      // Only one photo is allowed per line item — a new upload replaces any existing one.
      const file = Array.from(files || [])[0];
      if (!file) return;
      const compressed = await compressImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
      if (!file_url) throw new Error('The photo upload did not return a file URL.');
      setItemPhotos(prev => ({ ...prev, [itemId]: [file_url] }));
    } catch (error) {
      setPhotoError(error?.message || 'Photo upload failed. Please try again.');
      throw error;
    } finally {
      setUploadingItemPhoto(null);
    }
  };

  const removeItemPhoto = (itemId, index) => {
    setItemPhotos(prev => ({ ...prev, [itemId]: (prev[itemId] || []).filter((_, i) => i !== index) }));
  }

  // Real-time camera capture target: { type: 'item'|'deviations'|'updates', itemId? }
  const [cameraTarget, setCameraTarget] = useState(null);

  const handleCameraCapture = async (file) => {
    const target = cameraTarget;
    if (!file) return;
    try {
      if (target?.type === 'item' && target.itemId) {
        await uploadItemPhotos(target.itemId, [file]);
      } else if (target?.type === 'deviations') {
        await uploadMultiplePhotos([file], setDeviationsPhotos, setUploadingDeviations, deviationsPhotos.length);
      } else if (target?.type === 'updates') {
        await uploadMultiplePhotos([file], setUpdatesAttachments, setUploadingUpdates, updatesAttachments.length);
      }
      setCameraTarget(null);
    } catch (error) {
      // Leave the camera open so the user can retry or select a device photo.
      throw error;
    }
  };

  const allItems = useMemo(() => template.sections?.flatMap(s => s.items || []) || [], [template.sections]);
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());

  const toggleSection = (sectionId) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const setAnswer = (itemId, val) => {
    setAnswers(a => ({ ...a, [itemId]: a[itemId] === val ? undefined : val }));
    // Clear NO comment if toggling away from NO
    if (val !== 'NO') setNoComments(c => { const n = { ...c }; delete n[itemId]; return n; });
  };

  const [photoError, setPhotoError] = useState('');
  const [errorItemId, setErrorItemId] = useState(null);

  const revealItem = (itemId) => {
    if (!itemId) return;
    const section = template.sections?.find((candidate) => (candidate.items || []).some((sectionItem) => sectionItem.id === itemId));
    if (section) {
      setCollapsedSections((current) => {
        const next = new Set(current);
        next.delete(section.id);
        return next;
      });
    }
    window.setTimeout(() => {
      document.getElementById(`audit-item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const scrollToError = () => revealItem(errorItemId);

  const jumpToFirstUnanswered = () => {
    const item = allItems.find((candidate) => !answers[candidate.id]);
    if (item) revealItem(item.id);
  };

  const handleCancel = () => {
    if (hasProgress && !saving && !window.confirm('Leave this audit? Your current progress has been saved as a draft.')) return;
    onCancel();
  };

  const handleSubmit = async () => {
    if (submissionWindowClosed) {
      setErrorItemId(null);
      setPhotoError('The submission window for this checklist has closed. Your progress is saved as a draft — please contact an admin if this needs to be submitted late.');
      return;
    }
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
      if (!existingSubmission && !isTemplateAvailableNow(template)) {
        setSaving(false);
        return;
      }
      if (existingSubmission?.id) {
        const storedSig1 = await persistSignature(sig1Photo, 'audit_signature_1');
        const storedSig2 = await persistSignature(sig2Photo, 'audit_signature_2');
        await base44.entities.AuditSubmission.update(existingSubmission.id, {
          ...payload,
          signature1_photo_url: storedSig1,
          signature2_photo_url: storedSig2,
        });
      } else {
        const storedSig1 = await persistSignature(sig1Photo, 'audit_signature_1');
        const storedSig2 = await persistSignature(sig2Photo, 'audit_signature_2');
        const submissionPayload = {
          ...payload,
          signature1_photo_url: storedSig1,
          signature2_photo_url: storedSig2,
          submission_date: new Date().toISOString(),
          created_by: user.email,
        };
        const generatedTickets = [];

        // Prepare concern tickets, then save them with the audit in one database
        // transaction so a weak connection cannot leave partial records.
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
            generatedTickets.push({
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
              handling_history: [], escalated: false,
              sla_response_breached: false, sla_resolution_breached: false,
            });
          }
        }

        const bundle = await base44.audit.submitBundle(submissionPayload, generatedTickets);

        // Notification delivery happens after the database transaction. It may
        // be retried independently without duplicating the audit or tickets.
        for (const ticket of (bundle.tickets || [])) {
          if (!bundle.atomic) {
            await base44.functions.invoke('calculateSLA', { ticket_id: ticket.id });
          }
          await base44.functions.invoke('sendTicketNotification', {
            ticket_id: ticket.id,
            type: 'created',
            message: `Audit concern created: ${ticket.title}`,
          }).catch(() => {});
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
        <div className="flex flex-col gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <History className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Unsaved audit draft found</p>
              <p className="text-sm text-amber-700">
                You have an in-progress audit from {pendingDraft._savedAt ? new Date(pendingDraft._savedAt).toLocaleString() : 'earlier'}. Restore it to continue where you left off, or discard to start fresh.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <Button size="sm" variant="outline" onClick={discardDraft} className="border-amber-300 text-amber-800 hover:bg-amber-100">Discard</Button>
            <Button size="sm" onClick={restoreDraft} className="bg-amber-500 hover:bg-amber-600 text-white">Restore</Button>
          </div>
        </div>
      )}

      {/* Brand / Store selector */}
      <Card className="border-2 border-slate-200">
        <CardContent className="flex flex-col items-stretch gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center">
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
          ) : isStoreManager && selectableStores.length === 0 ? (
            <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">No eligible assigned store</p>
              <p className="mt-1 text-sm text-amber-700">This audit template is not assigned to any store currently linked to your branch manager account. Contact an administrator to update the store assignment.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Brand:</label>
                <Select value={selectedBrandId} onValueChange={(val) => { setSelectedBrandId(val); setSelectedStoreId(''); }}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Select brand..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableBrands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
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

      {/* Sticky progress and navigation */}
      <div className="sticky top-20 z-20 -mx-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur sm:mx-0 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">Checklist progress</span>
              <span className="text-xs font-semibold tabular-nums text-emerald-700">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{answered}/{allItems.length} answered</span>
              {hasProgress && <span className="hidden text-emerald-700 sm:inline">Draft autosaves securely</span>}
            </div>
          </div>
          {answered < allItems.length && (
            <Button type="button" variant="outline" size="sm" onClick={jumpToFirstUnanswered} className="shrink-0 gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Next unanswered</span>
              <span className="sm:hidden">Next</span>
            </Button>
          )}
        </div>
      </div>

      {/* Sections */}
      {template.sections?.map(sec => {
        const sectionItems = sec.items || [];
        const sectionAnswered = sectionItems.filter((item) => answers[item.id]).length;
        const collapsed = collapsedSections.has(sec.id);
        const complete = sectionItems.length > 0 && sectionAnswered === sectionItems.length;
        return (
        <Card key={sec.id} className={`border-2 shadow-sm transition-colors ${complete ? 'border-emerald-200' : 'border-slate-200'}`}>
          <CardHeader className="p-0">
            <button type="button" onClick={() => toggleSection(sec.id)} className="flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-4 text-left hover:bg-slate-50 sm:px-5" aria-expanded={!collapsed}>
              <div className="min-w-0">
                <CardTitle className="truncate text-sm font-bold uppercase tracking-wide text-emerald-700">{sec.title}</CardTitle>
                <p className="mt-1 text-xs font-medium text-slate-500">{sectionAnswered} of {sectionItems.length} answered</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {complete && <Badge className="border-0 bg-emerald-100 text-emerald-700">Complete</Badge>}
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
              </div>
            </button>
          </CardHeader>
          {!collapsed && <CardContent className="space-y-2 px-4 pb-4 sm:px-5">
            {(sec.items || []).map((item, idx) => (
              <div key={item.id} id={`audit-item-${item.id}`} className={`rounded-lg border-b border-slate-100 py-2 transition-colors last:border-0 ${errorItemId === item.id ? 'bg-rose-50 px-2 ring-1 ring-rose-200' : ''}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-slate-800">{idx + 1}. {item.label}</p>
                    {item.photo_required && (
                      <span className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${['YES', 'NO'].includes(answers[item.id]) && !(itemPhotos[item.id]?.length > 0) ? 'text-rose-600' : 'text-slate-400'}`}>
                        <Camera className="h-3 w-3" /> Photo required for Yes or No
                      </span>
                    )}
                  </div>
                  <div className="grid w-full flex-shrink-0 grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
                    {['YES', 'NO', 'NA'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAnswer(item.id, opt)}
                        className={`min-h-11 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all sm:min-h-0 sm:rounded-md sm:py-1 ${
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
                    <div className="flex flex-wrap items-center gap-2">
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
                              className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-100 transition-opacity sm:h-5 sm:w-5 sm:opacity-0 sm:group-hover:opacity-100">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>}
        </Card>
      )})}

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
                  onChange={e => e.target.files.length && uploadMultiplePhotos(e.target.files, setDeviationsPhotos, setUploadingDeviations, deviationsPhotos.length)} />
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
                  onChange={e => e.target.files.length && uploadMultiplePhotos(e.target.files, setUpdatesAttachments, setUploadingUpdates, updatesAttachments.length)} />
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
      {submissionWindowClosed && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The submission window for this checklist has closed. Contact an admin if this needs to be submitted late.
        </p>
      )}
      <div className="sticky bottom-0 z-20 -mx-4 flex justify-end gap-3 border-t border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-4">
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={saving || answered === 0 || (!isStoreLocked && !brand) || submissionWindowClosed}
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

