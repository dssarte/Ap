import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { BRAND_SERIES_COLORS } from '@/lib/checklistCompletion';

// At most six slices, so each can be told apart: every template with NO
// findings when there are six or fewer, otherwise the five with the most
// and the rest together as "Other" in a neutral gray. Slices take the
// palette in order; neighbouring slices (first and last included) pass the
// palette's color checks.
const MAX_SLICES = 6;
const OTHER_COLOR = '#cbd5e1';
// A slice narrower than this has no room for its percentage inside it —
// the list beside the pie gives every share.
const MIN_LABEL_SHARE = 0.06;
const RADIAN = Math.PI / 180;

const formatShare = (share) => `${Math.round(share * 1000) / 10}%`;

// White or dark text, whichever stands out more on the slice.
function inkOn(hex) {
  const channel = (at) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // 0.0589: the dark ink's (#0f172a) luminance + 0.05
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.0589 ? '#ffffff' : '#0f172a';
}

function SliceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-700">{slice.name}</p>
      <p className="text-slate-600">{slice.value.toLocaleString()} NO findings · {formatShare(slice.share)} of all</p>
      {slice.members ? (
        <p className="mt-1 text-slate-500">
          {slice.members.slice(0, 6).join(', ')}{slice.members.length > 6 ? ` and ${slice.members.length - 6} more` : ''}
        </p>
      ) : (
        <p className="text-slate-500">{slice.audits.toLocaleString()} audits · {slice.tickets.toLocaleString()} tickets</p>
      )}
    </div>
  );
}

// rows: the summary's per-template rows ({ id, title, noFindings, audits, tickets }),
// most NO findings first.
export default function NoFindingsByTemplateCard({ rows }) {
  const { slices, total, withoutFindings } = useMemo(() => {
    const withFindings = rows.filter(row => row.noFindings > 0);
    const sum = withFindings.reduce((acc, row) => acc + row.noFindings, 0);
    const own = withFindings.length <= MAX_SLICES ? withFindings : withFindings.slice(0, MAX_SLICES - 1);
    const rest = withFindings.slice(own.length);
    const list = own.map((row, i) => ({
      key: row.id,
      name: row.title,
      value: row.noFindings,
      audits: row.audits,
      tickets: row.tickets,
      color: BRAND_SERIES_COLORS[i],
    }));
    if (rest.length) {
      list.push({
        key: 'other',
        name: `Other (${rest.length} templates)`,
        value: rest.reduce((acc, row) => acc + row.noFindings, 0),
        members: rest.map(row => `${row.title} (${row.noFindings})`),
        color: OTHER_COLOR,
      });
    }
    return {
      slices: list.map(slice => ({ ...slice, share: sum ? slice.value / sum : 0, ink: inkOn(slice.color) })),
      total: sum,
      withoutFindings: rows.length - withFindings.length,
    };
  }, [rows]);

  const renderShare = ({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
    const slice = slices[index];
    if (!slice || slice.share < MIN_LABEL_SHARE) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
    return (
      <text
        x={cx + radius * Math.cos(-midAngle * RADIAN)}
        y={cy + radius * Math.sin(-midAngle * RADIAN)}
        fill={slice.ink}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
      >
        {formatShare(slice.share)}
      </text>
    );
  };

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
          <div className="grid items-center gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    startAngle={90}
                    endAngle={-270}
                    outerRadius="95%"
                    stroke="#ffffff"
                    strokeWidth={2}
                    labelLine={false}
                    label={renderShare}
                    isAnimationActive={false}
                  >
                    {slices.map(slice => <Cell key={slice.key} fill={slice.color} />)}
                  </Pie>
                  <Tooltip content={<SliceTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Kept narrow so each count stays next to its name on a wide screen. */}
            <ul className="w-full max-w-lg space-y-1.5 text-sm">
              {slices.map(slice => (
                <li key={slice.key} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: slice.color }} />
                  <span className="min-w-0 flex-1 truncate text-slate-700" title={slice.members ? slice.members.join(', ') : slice.name}>{slice.name}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{slice.value.toLocaleString()}</span>
                  <span className="w-14 text-right tabular-nums text-slate-500">{formatShare(slice.share)}</span>
                </li>
              ))}
              {withoutFindings > 0 && (
                <li className="pt-1 text-xs text-slate-400">
                  {withoutFindings} more template{withoutFindings === 1 ? '' : 's'} had no NO findings.
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
