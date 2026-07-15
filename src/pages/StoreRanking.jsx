import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from 'jspdf';
import ExcelExportButton from '@/components/ExcelExportButton';
import { exportSheetsToExcel } from '@/lib/exportExcel';

// Entity timestamps lack a trailing "Z", so parse them as UTC explicitly
// (otherwise the browser treats them as local time, shifting them by the
// user's UTC offset and dropping submissions near midnight into the wrong day).
function toUTCDate(date) {
  if (typeof date === 'string' && !/Z$|[+-]\d{2}:?\d{2}$/.test(date)) {
    return new Date(date + 'Z');
  }
  return new Date(date);
}

const PH_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Manila is UTC+8, no DST

const PASS_THRESHOLD = 75;
const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6979737791aaf996d5335e29/016378777_TheFigaroCoffeeGroup_logo.png";

function getRankColor(rank) {
  if (rank === 1) return 'bg-yellow-400 text-yellow-900';
  if (rank === 2) return 'bg-slate-400 text-slate-900';
  if (rank === 3) return 'bg-orange-400 text-orange-900';
  return 'bg-blue-600 text-white';
}

function ScoreChip({ score, label }) {
  const bg = score >= 80 ? 'bg-blue-600' : score >= 50 ? 'bg-red-500' : 'bg-red-600';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`${bg} text-white text-sm font-bold px-3 py-1.5 rounded min-w-[72px] text-center`}>
        {score.toFixed(2)}%
      </span>
      <span className="text-xs text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// Fetch image as base64 for jsPDF
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

export default function StoreRanking() {
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: brands = [] } = useQuery({
    queryKey: ['brands-active'],
    queryFn: () => base44.entities.Brand.filter({ is_active: true }, 'brand_name', 200),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-active'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'store_name', 200),
  });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['audit-submissions-all'],
    queryFn: () => base44.entities.AuditSubmission.list('-created_date', 500),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['audit-templates-all'],
    queryFn: () => base44.entities.AuditTemplate.list('title', 200),
  });

  // Unique template titles (in order of appearance)
  const allTemplateTitles = useMemo(() => {
    const seen = new Set();
    const titles = [];
    submissions.forEach(s => {
      if (s.template_title && !seen.has(s.template_id)) {
        seen.add(s.template_id);
        titles.push({ id: s.template_id, title: s.template_title });
      }
    });
    return titles;
  }, [submissions]);

  // Only include QA audit templates (no store restrictions) in rankings — store-only
  // checklists (Opening/Closing/OD/Mid, filled by store staff for themselves) are excluded.
  const qaTemplateIds = useMemo(() => {
    return new Set(
      templates
        .filter(t => !(t.store_restrictions?.length > 0 || t.store_name))
        .map(t => t.id)
    );
  }, [templates]);

  // Build ranking grouped by brand+store
  const rankings = useMemo(() => {
    let filtered = submissions.filter(s => s.brand && s.score != null && qaTemplateIds.has(s.template_id));

    if (selectedBrandId !== 'all') {
      const brand = brands.find(b => b.id === selectedBrandId);
      if (brand) filtered = filtered.filter(s => s.brand.startsWith(brand.brand_name));
    }

    // Compare using the submission's PH-local calendar day, since dateFrom/dateTo
    // are PH-local dates picked by the user.
    if (dateFrom) {
      const fromUTC = new Date(dateFrom).getTime() - PH_OFFSET_MS;
      filtered = filtered.filter(s => toUTCDate(s.submission_date || s.created_date).getTime() >= fromUTC);
    }
    if (dateTo) {
      const toUTC = new Date(dateTo).getTime() + (24 * 60 * 60 * 1000 - 1) - PH_OFFSET_MS;
      filtered = filtered.filter(s => toUTCDate(s.submission_date || s.created_date).getTime() <= toUTC);
    }

    const groups = {};
    filtered.forEach(sub => {
      const key = sub.brand;
      if (!groups[key]) groups[key] = { brand: key, submissions: [] };
      groups[key].submissions.push(sub);
    });

    return Object.values(groups)
      .map(g => {
        const avgScore = g.submissions.reduce((sum, s) => sum + s.score, 0) / g.submissions.length;

        const templateGroups = {};
        g.submissions.forEach(s => {
          if (!templateGroups[s.template_id]) {
            templateGroups[s.template_id] = { title: s.template_title, scores: [] };
          }
          templateGroups[s.template_id].scores.push(s.score);
        });

        const templateScores = Object.values(templateGroups).map(tg => ({
          title: tg.title,
          avg: tg.scores.reduce((a, b) => a + b, 0) / tg.scores.length,
        }));

        return {
          brand: g.brand,
          avgScore,
          templateScores,
          templateGroups,
          count: g.submissions.length,
          isPassing: avgScore >= PASS_THRESHOLD,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [submissions, brands, selectedBrandId, dateFrom, dateTo, qaTemplateIds]);

  // Get selected brand name for display
  const selectedBrand = brands.find(b => b.id === selectedBrandId);
  const brandLabel = selectedBrand ? selectedBrand.brand_name.toUpperCase() : 'ALL BRANDS';

  // Templates visible in current filtered view
  const visibleTemplates = useMemo(() => {
    const seen = new Set();
    const titles = [];
    rankings.forEach(r => {
      r.templateScores.forEach(ts => {
        if (!seen.has(ts.title)) {
          seen.add(ts.title);
          titles.push(ts.title);
        }
      });
    });
    return titles;
  }, [rankings]);

  // --- CSV Export ---
  const handleExportCsv = () => {
    const headers = ['Ranking', 'Stores', ...visibleTemplates, 'Average', 'Rating', 'Store Manager'];
    const rows = [headers];
    rankings.forEach(r => {
      const templateCols = visibleTemplates.map(t => {
        const ts = r.templateScores.find(ts => ts.title === t);
        return ts ? ts.avg.toFixed(2) : '0.00';
      });
      rows.push([r.rank, r.brand, ...templateCols, r.avgScore.toFixed(2), r.isPassing ? 'PASS' : 'FAIL', '-']);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store_ranking_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Excel Export ---
  const handleExportExcel = () => {
    const sheets = [
      {
        name: 'Store Ranking',
        title: `Store Ranking — ${brandLabel} · ${dateFrom} to ${dateTo}`,
        headers: ['Ranking', 'Stores', ...visibleTemplates, 'Average', 'Rating', 'Store Manager'],
        rows: rankings.map(r => [
          r.rank, r.brand,
          ...visibleTemplates.map(t => {
            const ts = r.templateScores.find(ts => ts.title === t);
            return ts ? ts.avg.toFixed(2) : '0.00';
          }),
          r.avgScore.toFixed(2),
          r.isPassing ? 'PASS' : 'FAIL',
          '-',
        ]),
      },
      {
        name: 'Template Averages',
        headers: ['Store', 'Template', 'Average Score'],
        rows: rankings.flatMap(r => r.templateScores.map(ts => [r.brand, ts.title, ts.avg.toFixed(2)])),
      },
    ];
    exportSheetsToExcel('Store_Ranking', sheets);
  };

  // --- PDF Export ---
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const logoBase64 = await fetchImageBase64(LOGO_URL);

      // Header logos
      const logoW = 22, logoH = 22, logoY = 8;
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 10, logoY, logoW, logoH);
        doc.addImage(logoBase64, 'PNG', pageW - 10 - logoW, logoY, logoW, logoH);
      }

      const now = new Date();
      const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' }).toUpperCase();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(31, 65, 154);
      doc.text('FIGARO COFFEE SYSTEM, INC.', pageW / 2, 13, { align: 'center' });
      doc.text('QUALITY ASSURANCE DEPARTMENT', pageW / 2, 18, { align: 'center' });
      doc.text(`${brandLabel} - STORE RANKING`, pageW / 2, 23, { align: 'center' });
      doc.text(`FOR THE MONTH OF ${monthYear}`, pageW / 2, 28, { align: 'center' });

      // Table setup
      const margin = 10;
      const tableW = pageW - margin * 2;
      const colHeaders = ['RANKING', 'STORES', ...visibleTemplates, 'AVERAGE', 'RATING', 'STORE MANAGER'];
      const totalCols = colHeaders.length;

      // Column widths: rank=18, stores=30, templates share middle, avg=20, rating=18, manager=28
      const fixedW = { rank: 16, stores: 30, avg: 20, rating: 18, manager: 28 };
      const templateW = totalCols > 5
        ? (tableW - fixedW.rank - fixedW.stores - fixedW.avg - fixedW.rating - fixedW.manager) / visibleTemplates.length
        : 30;
      const colWidths = [fixedW.rank, fixedW.stores, ...visibleTemplates.map(() => templateW), fixedW.avg, fixedW.rating, fixedW.manager];

      const rowH = 10;
      const headerH = 14; // taller for wrapped header text
      let y = 34;

      // Draw header row
      const drawHeaderRow = (startY) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, startY, tableW, headerH, 'F');
        doc.setDrawColor(180, 180, 180);
        doc.rect(margin, startY, tableW, headerH, 'S');

        let x = margin;
        colHeaders.forEach((h, i) => {
          // vertical cell divider
          if (i > 0) {
            doc.setDrawColor(180, 180, 180);
            doc.line(x, startY, x, startY + headerH);
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(31, 65, 154);
          // wrap text in cell
          const lines = doc.splitTextToSize(h, colWidths[i] - 2);
          const textY = startY + (headerH - lines.length * 3.5) / 2 + 3;
          lines.forEach((line, li) => {
            doc.text(line, x + colWidths[i] / 2, textY + li * 3.5, { align: 'center' });
          });
          x += colWidths[i];
        });
      };

      drawHeaderRow(y);
      y += headerH;

      // Draw data rows
      rankings.forEach((r, rowIdx) => {
        // Page break check
        if (y + rowH > pageH - 10) {
          doc.addPage();
          y = 10;
          drawHeaderRow(y);
          y += headerH;
        }

        const bg = rowIdx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
        doc.setFillColor(...bg);
        doc.rect(margin, y, tableW, rowH, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, y, tableW, rowH, 'S');

        const rowData = [
          String(r.rank),
          r.brand,
          ...visibleTemplates.map(t => {
            const ts = r.templateScores.find(ts => ts.title === t);
            return ts ? ts.avg.toFixed(2) : '0.00';
          }),
          r.avgScore.toFixed(2),
          r.isPassing ? 'PASS' : 'FAIL',
          '-',
        ];

        let x = margin;
        rowData.forEach((val, i) => {
          if (i > 0) {
            doc.setDrawColor(200, 200, 200);
            doc.line(x, y, x, y + rowH);
          }

          const cx = x + colWidths[i] / 2;
          const cy = y + rowH / 2 + 1;

          if (i === colHeaders.length - 2) {
            // RATING cell — colored badge
            const isPass = val === 'PASS';
            const badgeColor = isPass ? [31, 185, 85] : [239, 68, 68];
            doc.setFillColor(...badgeColor);
            const bw = colWidths[i] - 4, bh = rowH - 3;
            doc.roundedRect(x + 2, y + 1.5, bw, bh, 1.5, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(val, cx, cy, { align: 'center' });
          } else if (i === 0) {
            // RANK cell — color top 3
            const rank = r.rank;
            let rankBg = null;
            if (rank === 1) rankBg = [250, 204, 21];
            else if (rank === 2) rankBg = [148, 163, 184];
            else if (rank === 3) rankBg = [251, 146, 60];
            if (rankBg) {
              doc.setFillColor(...rankBg);
              doc.rect(x, y, colWidths[i], rowH, 'F');
            }
            doc.setTextColor(rank <= 3 ? 50 : 31, 65, 154);
            doc.setFont('helvetica', rank <= 3 ? 'bold' : 'normal');
            doc.setFontSize(8);
            doc.text(val, cx, cy, { align: 'center' });
          } else {
            doc.setTextColor(60, 60, 60);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const lines = doc.splitTextToSize(val, colWidths[i] - 2);
            const textY = y + (rowH - lines.length * 3.5) / 2 + 3;
            lines.forEach((line, li) => doc.text(line, cx, textY + li * 3.5, { align: 'center' }));
          }

          x += colWidths[i];
        });

        y += rowH;
      });

      doc.save(`store_ranking_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="app-page app-page-narrow">
      {/* Header */}
      <div className="app-page-header">
        <div><p className="app-page-eyebrow">Quality leaderboard</p><h1 className="app-page-heading">Store ranking</h1><p className="app-page-description">Compare audit performance across stores and brands.</p></div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportCsv} variant="outline" className="font-bold gap-2 border-slate-300">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={handleExportPdf} disabled={exportingPdf} className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-bold gap-2">
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            PDF
          </Button>
          <ExcelExportButton onClick={handleExportExcel} disabled={rankings.length === 0} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
          />
          <span className="text-slate-400 text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-[#1fd655]"
          />
        </div>
      </div>

      {/* Rankings */}
      {!dateFrom || !dateTo ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">Please select a date range to view store rankings.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : rankings.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">No audit submissions found for the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rankings.map(item => (
            <Card key={item.brand} className="border-2 border-slate-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="mb-3">
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mb-1 ${item.isPassing ? 'bg-[#1fd655] text-slate-900' : 'bg-red-500 text-white'}`}>
                    {item.isPassing ? 'PASS' : 'FAIL'}
                  </span>
                  <p className="text-lg font-bold text-slate-900">{item.brand}</p>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-extrabold ${getRankColor(item.rank)}`}>
                      {item.rank}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rank</span>
                  </div>

                  {item.templateScores.map((ts, i) => (
                    <ScoreChip key={i} score={ts.avg} label={ts.title} />
                  ))}

                  <ScoreChip score={item.avgScore} label="Overall Average" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
