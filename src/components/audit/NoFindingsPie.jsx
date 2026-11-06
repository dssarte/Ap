import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { BRAND_SERIES_COLORS } from '@/lib/checklistCompletion';

// At most six slices, so each can be told apart: every part when there are
// six or fewer, otherwise the five largest and the rest together as "Other"
// in a neutral gray. Slices take the palette in order; neighbouring slices
// (first and last included) pass the palette's color checks.
const MAX_SLICES = 6;
const OTHER_COLOR = '#cbd5e1';
// A percentage goes inside its slice only where it fits across the slice
// (about this many px a character, plus room on either side) — the list
// beside the pie gives every share.
const LABEL_CHAR_W = 7;
const LABEL_PAD = 6;
const RADIAN = Math.PI / 180;
// The list shows every part; past this many rows it scrolls in place.
const MAX_LIST_ROWS = 20;
const LIST_ROW_H = 26;

export const formatShare = (share) => `${Math.round(share * 1000) / 10}%`;

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

/**
 * A pie of NO findings and its list. parts: [{ key, name, value, detail? }]
 * — every one, those without NO findings too. otherNoun names what folds
 * into "Other" ("templates", "categories").
 * Returns { total, slices, rows }: the pie's slices (at most six), and the
 * list's rows — every part: the slices, each part folded into Other (just
 * under its row), then the parts with no NO findings.
 */
export function pieSlices(parts, otherNoun) {
  const found = parts.filter(part => part.value > 0).sort((a, b) => b.value - a.value);
  const none = parts.filter(part => !(part.value > 0));
  const total = found.reduce((acc, part) => acc + part.value, 0);
  const shareOf = (value) => (total ? value / total : 0);
  const own = found.length <= MAX_SLICES ? found : found.slice(0, MAX_SLICES - 1);
  const rest = found.slice(own.length);
  const list = own.map((part, i) => ({ ...part, color: BRAND_SERIES_COLORS[i] }));
  if (rest.length) {
    list.push({
      key: '__other',
      name: `Other (${rest.length} ${otherNoun})`,
      value: rest.reduce((acc, part) => acc + part.value, 0),
      members: rest.map(part => `${part.name} (${part.value.toLocaleString()})`),
      color: OTHER_COLOR,
    });
  }
  const slices = list.map(slice => ({ ...slice, share: shareOf(slice.value), ink: inkOn(slice.color) }));
  return {
    total,
    slices,
    rows: [
      ...slices,
      ...rest.map(part => ({ ...part, share: shareOf(part.value), inOther: true })),
      ...none.map(part => ({ ...part, value: 0, share: 0, none: true })),
    ],
  };
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
      ) : slice.detail ? (
        <p className="mt-1 text-slate-500">{slice.detail}</p>
      ) : null}
    </div>
  );
}

// The pie, each share printed inside its slice, and beside it the list of
// every part's name, NO findings and share. slices / rows: from pieSlices;
// noun: what the rows are ("templates").
export default function NoFindingsPie({ slices, rows, noun }) {
  const listed = rows.filter(row => row.key !== '__other').length;
  const scrolls = rows.length > MAX_LIST_ROWS;
  const renderShare = ({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
    const slice = slices[index];
    if (!slice) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
    const text = formatShare(slice.share);
    // The slice's width at the label: its arc at that radius.
    if (radius * slice.share * 2 * Math.PI < text.length * LABEL_CHAR_W + LABEL_PAD) return null;
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
        {text}
      </text>
    );
  };

  return (
    // grid-cols-1 (not the default auto column) lets the list narrow on a
    // phone, so long names shorten with "…" instead of pushing the figures out.
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
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
      {/* Kept narrow so each count stays next to its name on a wide screen.
          Parts in Other sit indented under it; parts with none come last. */}
      <div className="w-full max-w-lg">
        <ul
          className={`space-y-1.5 text-sm ${scrolls ? 'overflow-y-auto pr-2' : ''}`}
          style={scrolls ? { maxHeight: MAX_LIST_ROWS * LIST_ROW_H } : undefined}
        >
          {rows.map(row => (
            <li key={row.key} className={`flex items-center gap-2 ${row.inOther ? 'pl-8' : ''}`}>
              {!row.inOther && (
                <span className="h-3 w-3 shrink-0 rounded-[3px]" style={row.none ? undefined : { backgroundColor: row.color }} />
              )}
              <span
                className={`min-w-0 flex-1 truncate ${row.none ? 'text-slate-400' : row.inOther ? 'text-slate-500' : 'text-slate-700'}`}
                title={row.members ? row.members.join(', ') : row.name}
              >
                {row.name}
              </span>
              <span className={`tabular-nums ${row.none ? 'text-slate-400' : row.inOther ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                {row.value.toLocaleString()}
              </span>
              <span className={`w-14 text-right tabular-nums ${row.none ? 'text-slate-400' : 'text-slate-500'}`}>{formatShare(row.share)}</span>
            </li>
          ))}
        </ul>
        {scrolls && <p className="pt-2 text-xs text-slate-400">{listed} {noun} — scroll the list to see them all.</p>}
      </div>
    </div>
  );
}
