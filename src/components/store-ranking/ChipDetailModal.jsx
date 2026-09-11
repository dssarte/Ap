import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, FileText } from "lucide-react";
import { formatPHDateTime } from '@/lib/dateUtils';
import { computeFrontCover } from '@/components/store-ranking/FrontCoverModal';
import SubmissionDetail from '@/components/audit/SubmissionDetail';

// Opened from one Store Ranking score chip — which already represents a
// single template + audit type (or just a template, when it doesn't ask for
// one). Because it's scoped to exactly what that chip covers, the Front
// Cover tab here never has to reconcile multiple audit types in one sheet
// the way a whole-store view would — it's always one visit type's own
// breakdown, same as the printed form.
export default function ChipDetailModal({ label, submissions, templatesById, passThreshold, onClose }) {
  const sorted = useMemo(
    () => [...submissions].sort((a, b) => new Date(b.submission_date) - new Date(a.submission_date)),
    [submissions]
  );
  const [selectedId, setSelectedId] = useState(sorted[0]?.id);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState('front-cover');
  const submissionDetailRef = React.useRef(null);

  const selectedSubmission = sorted.find(s => s.id === selectedId) || sorted[0];

  const { sectionRows, totals } = useMemo(
    () => computeFrontCover(submissions, templatesById),
    [submissions, templatesById]
  );
  const answered = totals.yes + totals.no;
  const averageRating = answered > 0 ? (totals.yes / answered) * 100 : 0;
  const isPassing = averageRating >= passThreshold;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="front-cover">Front Cover</TabsTrigger>
              <TabsTrigger value="submission">Audit Submission</TabsTrigger>
            </TabsList>
            {activeTab === 'submission' && (
              <Button
                onClick={() => submissionDetailRef.current?.exportPdf()}
                disabled={exportingPdf}
                size="sm"
                className="bg-[#1fd655] hover:bg-[#1bc14c] text-slate-900 font-bold gap-2 shrink-0"
              >
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Export PDF
              </Button>
            )}
          </div>

          <TabsContent value="front-cover" className="space-y-4 pt-4">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Areas of Concern</th>
                    <th className="px-3 py-2 text-center">Yes</th>
                    <th className="px-3 py-2 text-center">No</th>
                    <th className="px-3 py-2 text-center">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionRows.map(row => (
                    <tr key={row.title} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{row.title}</td>
                      <td className="px-3 py-2 text-center text-emerald-600 font-semibold">{row.yes}</td>
                      <td className="px-3 py-2 text-center text-red-600 font-semibold">{row.no}</td>
                      <td className="px-3 py-2 text-center text-slate-400">{row.na}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td className="px-3 py-2 text-slate-900">TOTAL</td>
                    <td className="px-3 py-2 text-center text-emerald-700">{totals.yes}</td>
                    <td className="px-3 py-2 text-center text-red-700">{totals.no}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{totals.na}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={`flex items-center justify-between rounded-xl border-2 p-4 ${isPassing ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wide ${isPassing ? 'text-emerald-700' : 'text-red-700'}`}>
                  {isPassing ? 'PASSED' : 'FAILED'} the audit
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Pass threshold: {passThreshold.toFixed(0)}%</p>
              </div>
              <span className={`text-2xl font-extrabold ${isPassing ? 'text-emerald-700' : 'text-red-700'}`}>
                {averageRating.toFixed(2)}%
              </span>
            </div>
          </TabsContent>

          <TabsContent value="submission" className="space-y-3 pt-4">
            {sorted.length > 1 && (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {formatPHDateTime(s.submission_date)} — {s.score != null ? `${s.score}%` : '—'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedSubmission && (
              <SubmissionDetail
                ref={submissionDetailRef}
                submission={selectedSubmission}
                templates={Object.values(templatesById)}
                hideExportButton
                onExportingChange={setExportingPdf}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
