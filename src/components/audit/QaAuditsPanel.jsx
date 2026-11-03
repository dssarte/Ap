import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, ClipboardCheck } from "lucide-react";
import { AuditResultBadge } from '@/components/audit/SubmissionDetail';
import TablePagination from '@/components/TablePagination';
import { usePagination } from '@/hooks/usePagination';
import { formatScore, answerCounts, auditResult } from '@/lib/auditScore';
import { formatPHDateTime, formatPHDateShort } from '@/lib/dateUtils';
import { normalizeChecklistCategory } from '@/lib/checklistCategories';

const AUDIT_TYPE_LABELS = { unannounced: 'Unannounced', follow_up: 'Follow-up', spot: 'Spot', reassessment: 'Re-assessment' };

// One row per QA audit, newest first — shared by the tab's table and the
// dashboard's Excel export. Each audit is graded against its own
// checklist's pass mark (92.5% for QA checklists; N/A for one that isn't
// graded pass/fail), never the store checklists' 75%.
export function buildQaAuditRows(submissions, templatesById) {
  return [...submissions]
    .sort((a, b) => new Date(b.submission_date || b.created_date) - new Date(a.submission_date || a.created_date))
    .map(s => {
      const template = templatesById[s.template_id];
      const date = s.submission_date || s.created_date;
      // A Mystery Shopper audit is dated by the shopper's visit — no real time of day.
      const isMysteryShopper = normalizeChecklistCategory(template?.checklist_category) === 'mystery_shopper';
      return {
        submission: s,
        dateText: isMysteryShopper ? formatPHDateShort(date) : formatPHDateTime(date),
        auditType: AUDIT_TYPE_LABELS[s.audit_type] || s.audit_type || '—',
        result: auditResult(s.score, template),
        ncf: answerCounts(s).no,
      };
    });
}

// The Audit Dashboard's QA Audits tab: QA's visits kept apart from the
// stores' own checklists.
export default function QaAuditsPanel({ submissions, templatesById, loading, onOpen }) {
  const rows = useMemo(() => buildQaAuditRows(submissions, templatesById), [submissions, templatesById]);

  const summary = useMemo(() => {
    // Blended over every audit's YES/NO points — the same rating QA
    // Dashboard and Store Ranking give a store.
    const yes = submissions.reduce((sum, s) => sum + Number(s.yes_count || 0), 0);
    const no = submissions.reduce((sum, s) => sum + Number(s.no_count || 0), 0);
    return {
      avg: yes + no > 0 ? (yes / (yes + no)) * 100 : null,
      passed: rows.filter(r => r.result === 'PASS').length,
      failed: rows.filter(r => r.result === 'FAIL').length,
      notGraded: rows.filter(r => r.result === 'N/A').length,
    };
  }, [submissions, rows]);

  const pagination = usePagination(rows);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  if (rows.length === 0) {
    return (
      <Card className="border-2 border-dashed border-slate-200">
        <CardContent className="py-16 text-center">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">No QA audits found for the selected filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Average QA Score', value: summary.avg != null ? formatScore(summary.avg) : '—', color: 'text-slate-900' },
          { label: 'QA Audits', value: rows.length, color: 'text-slate-900' },
          { label: 'Passed', value: summary.passed, color: 'text-green-600' },
          { label: 'Failed', value: summary.failed, color: 'text-red-600' },
        ].map(k => (
          <Card key={k.label} className="border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-3xl font-extrabold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {summary.notGraded > 0 && (
        <p className="text-xs text-slate-500">
          {summary.notGraded} audit{summary.notGraded === 1 ? ' is' : 's are'} on a checklist that isn't graded pass/fail, so not counted as passed or failed.
        </p>
      )}

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <p className="font-bold text-slate-800">QA Audits</p>
          <p className="text-xs text-slate-500">Each audit is graded against its own checklist's pass mark. Click one to open its report.</p>
        </CardHeader>
        <CardContent className="px-0 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Store</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Checklist</th>
                  <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Audit Type</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Score</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">NCF</th>
                  <th className="text-center px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Result</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map(({ submission: s, dateText, auditType, result, ncf }, i) => (
                  <tr
                    key={s.id}
                    onClick={() => onOpen(s)}
                    className={`cursor-pointer transition-colors hover:bg-emerald-50/60 border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}
                  >
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{dateText}</td>
                    <td className="px-3 py-3 text-slate-700 text-xs">{s.brand || '—'}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{s.template_title}</td>
                    <td className="px-3 py-3 text-slate-600 text-xs">{auditType}</td>
                    <td className="px-3 py-3 text-center font-bold text-slate-900">{formatScore(s.score)}</td>
                    <td className="px-3 py-3 text-center font-semibold text-red-600">{ncf}</td>
                    <td className="px-5 py-3 text-center"><AuditResultBadge result={result} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="px-5 pt-4" />
        </CardContent>
      </Card>
    </>
  );
}
