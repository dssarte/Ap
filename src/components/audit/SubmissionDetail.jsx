import React, { useState, forwardRef, useImperativeHandle } from 'react';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";
import { formatPHDateTime, formatPHDateShort } from '@/lib/dateUtils';
import PhotoThumb from '@/components/audit/PhotoThumb';
import { normalizeChecklistCategory } from '@/lib/checklistCategories';

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

const ROMAN_NUMERAL_VALUES = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
function toRomanNumeral(num) {
  let n = num;
  let result = '';
  for (const [value, symbol] of ROMAN_NUMERAL_VALUES) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

export function ScoreBadge({ score }) {
  if (score == null) return null;
  const color = score >= 80 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <Badge className={`${color} border-0 font-bold text-base px-3 py-1`}>{score}%</Badge>;
}

const SubmissionDetail = forwardRef(function SubmissionDetail(
  { submission, templates, user, hideExportButton, onExportingChange },
  ref
) {
  const template = templates.find(t => t.id === submission.template_id);
  const isQaViewer = user?.user_type === 'admin' || user?.department_name === 'Quality Assurance';
  const isMysteryShopperTemplate = normalizeChecklistCategory(template?.checklist_category) === 'mystery_shopper';
  // QA/admin default to the full item-by-item scored breakdown (they need
  // it to grade and verify) but can switch to the same summary a store sees
  // via the toggle below — e.g. to generate that condensed version
  // themselves. A store viewer has no toggle: summary is the only option.
  const qualifiesForSummary = !!template?.requires_audit_type && !isMysteryShopperTemplate;
  const [viewMode, setViewMode] = useState('detailed');
  const useSummaryView = qualifiesForSummary && (!isQaViewer || viewMode === 'summary');
  const sectionsWithDeviations = (template?.sections || []).map(sec => {
    let deviationCounter = 0;
    const items = (sec.items || []).map(item => {
      const isNo = submission.answers?.[item.id] === 'NO';
      return { item, isNo, num: isNo ? ++deviationCounter : null };
    });
    const failedItems = items.filter(i => i.isNo);
    return {
      sec,
      items,
      hasDeviation: failedItems.length > 0,
    };
  });
  const [exportingPdf, setExportingPdfState] = useState(false);
  const setExportingPdf = (val) => {
    setExportingPdfState(val);
    onExportingChange?.(val);
  };

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

      // Summary row — Submitted by / Branch / Date each have a fixed-width
      // slot since they share one row; a long value wraps onto extra lines
      // within its own column (jsPDF text has no auto-wrap/clip of its own,
      // so without this it would run straight into the next field) rather
      // than being cut off. The row grows to fit whichever field wraps the
      // most. Location gets its own full-width row inside the same bordered
      // container instead of a separate block below it.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const submittedByWrapped = doc.splitTextToSize(submission.submitted_by_name || submission.submitted_by_email || '-', 44);
      const brandWrapped = submission.brand ? doc.splitTextToSize(submission.brand, 53) : [];

      const hasLocation = !!submission.location;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const locationWrapped = hasLocation ? doc.splitTextToSize(submission.location, contentW - 26) : [];
      const firstRowLines = Math.max(1, submittedByWrapped.length, brandWrapped.length);
      const firstRowHeight = Math.max(16, 9 + firstRowLines * 4);
      const locationRowHeight = hasLocation ? (locationWrapped.length * 4 + 6) : 0;
      const boxHeight = firstRowHeight + locationRowHeight;

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, boxHeight, 2, 2, 'FD');

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
      doc.text(submittedByWrapped, margin + 28, y + 10);

      if (submission.brand) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text('Branch / Brand', margin + 75, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(brandWrapped, margin + 75, y + 10);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text('Date', pageW - margin - 55, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(formatPHDateTime(submission.submission_date || submission.created_date), pageW - margin - 55, y + 10);

      // YES/NO/NA counts — omitted from the store-facing summary export; the
      // overall score badge above already conveys the grade without
      // exposing the raw scored breakdown.
      if (!useSummaryView) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(34, 197, 94);
        doc.text(`YES: ${submission.yes_count}`, pageW - margin - 6, y + 5, { align: 'right' });
        doc.setTextColor(239, 68, 68);
        doc.text(`NO: ${submission.no_count}`, pageW - margin - 6, y + 10, { align: 'right' });
        doc.setTextColor(150, 150, 150);
        doc.text(`N/A: ${submission.na_count}`, pageW - margin - 6, y + 15, { align: 'right' });
      }

      if (hasLocation) {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin + 4, y + firstRowHeight, margin + contentW - 4, y + firstRowHeight);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('Location', margin + 4, y + firstRowHeight + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(locationWrapped, margin + 22, y + firstRowHeight + 5);
      }

      y += boxHeight + 4;

      // Item photos — shared by both the detailed and summary section renderers below
      const drawItemPhotoGrid = async (urls) => {
        const imgW = 30, imgH = 22, gap = 3;
        addPageIfNeeded(imgH + 4);
        let px = margin + 2;
        for (const url of urls) {
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
      };

      // Sections
      if (template?.sections) {
        for (const { sec, items, hasDeviation } of sectionsWithDeviations) {
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

          if (useSummaryView) {
            if (!hasDeviation) {
              addPageIfNeeded(6);
              doc.setTextColor(100, 116, 139);
              doc.setFont('helvetica', 'italic');
              doc.setFontSize(8);
              doc.text('No noted deviation.', margin + 2, y + 4);
              y += 8;
            } else {
              for (const { item, num } of items.filter(i => i.isNo)) {
                addPageIfNeeded(8);
                doc.setTextColor(30, 30, 30);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                const label = `${toRomanNumeral(num)}. ${item.label}`;
                const wrappedLabel = doc.splitTextToSize(label, contentW - 4);
                doc.text(wrappedLabel, margin + 2, y + 4);
                y += wrappedLabel.length * 4 + 2;

                const noComment = submission.no_comments?.[item.id];
                if (noComment) {
                  doc.setTextColor(80, 80, 80);
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(8);
                  const reasonWrapped = doc.splitTextToSize(`- ${noComment}`, contentW - 8);
                  addPageIfNeeded(reasonWrapped.length * 4 + 2);
                  doc.text(reasonWrapped, margin + 4, y + 4);
                  y += reasonWrapped.length * 4 + 2;
                }

                const itemPhotoUrls = submission.item_photos?.[item.id];
                if (itemPhotoUrls?.length) await drawItemPhotoGrid(itemPhotoUrls);
                y += 2;
              }
            }
          } else {
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
              if (itemPhotoUrls?.length) await drawItemPhotoGrid(itemPhotoUrls);
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

  useImperativeHandle(ref, () => ({ exportPdf: handleExportPdf, exportingPdf }));

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
          {submission.audit_type && (
            <div>
              <p className="text-xs text-slate-500">Audit Type</p>
              <p className="font-semibold text-slate-900 capitalize">{submission.audit_type.replace('_', '-')}</p>
            </div>
          )}
          {submission.visit_number && (
            <div>
              <p className="text-xs text-slate-500">Visit</p>
              <p className="font-semibold text-slate-900 capitalize">{submission.visit_number} Visit</p>
            </div>
          )}
          {submission.commitment_date && (
            <div>
              <p className="text-xs text-slate-500">Commitment Date</p>
              <p className="font-semibold text-slate-900">{formatPHDateShort(submission.commitment_date)}</p>
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
          <div className="ml-auto flex items-center gap-3">
            {qualifiesForSummary && isQaViewer && (
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('detailed')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === 'detailed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Detailed
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('summary')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === 'summary' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Summary
                </button>
              </div>
            )}
            {!hideExportButton && (
              <Button onClick={handleExportPdf} disabled={exportingPdf} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-bold gap-2">
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Export PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {useSummaryView ? (
        <Card className="border-2 border-slate-200">
          <CardContent className="p-5 space-y-5">
            {sectionsWithDeviations.map(({ sec, items, hasDeviation }) => (
              <div key={sec.id}>
                <p className="text-sm font-bold uppercase tracking-wide text-[#1fd655] mb-1.5">{sec.title}</p>
                {!hasDeviation ? (
                  <p className="text-sm text-slate-500 italic">No noted deviation.</p>
                ) : (
                  <div className="space-y-3">
                    {items.filter(i => i.isNo).map(({ item, num }) => {
                      const noComment = submission.no_comments?.[item.id];
                      const photos = submission.item_photos?.[item.id];
                      return (
                        <div key={item.id}>
                          <p className="text-sm text-slate-900"><span className="font-bold">{toRomanNumeral(num)}. {item.label}</span></p>
                          {noComment && <p className="mt-0.5 text-sm text-slate-600">- {noComment}</p>}
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
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        template?.sections?.map(sec => (
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
        ))
      )}

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
});

export default SubmissionDetail;