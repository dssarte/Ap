import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import NoFindingsPie, { pieSlices } from '@/components/audit/NoFindingsPie';

// rows: the summary's per-template rows ({ id, title, noFindings, audits, tickets }),
// most NO findings first. Every one is listed, those without NO findings too.
export default function NoFindingsByTemplateCard({ rows }) {
  const { slices, rows: listRows, total } = useMemo(() => pieSlices(
    rows.map(row => ({
      key: row.id,
      name: row.title,
      value: row.noFindings,
      detail: `${row.audits.toLocaleString()} audits · ${row.tickets.toLocaleString()} tickets`,
    })),
    'templates',
  ), [rows]);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5">
        <p className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> NO Findings by Template</p>
        <p className="text-xs text-slate-500">
          {total ? `Each template's share of the ${total.toLocaleString()} NO findings in range.` : 'Each template\'s share of the NO findings in range.'}
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No NO findings in this range.</p>
        ) : (
          <NoFindingsPie slices={slices} rows={listRows} noun="templates" />
        )}
      </CardContent>
    </Card>
  );
}
