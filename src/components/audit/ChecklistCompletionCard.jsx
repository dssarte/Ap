import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarCheck, Settings2, ChevronDown, ChevronUp, Loader2, Store, ListX, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import Spinner from '@/components/Spinner';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import moment from 'moment';
import { COMPLETION_TARGET, roundRate, completionCellState, completionRateScale, BRAND_SERIES_COLORS, brandSeriesColor } from '@/lib/checklistCompletion';

const BAR_COLOR = BRAND_SERIES_COLORS[0];
// Chart chrome in the page's own slate ink.
const INK = { text: '#475569', muted: '#94a3b8', grid: '#e2e8f0', axis: '#cbd5e1' };

// A store's day on the grid, in the reserved status colors — each shown
// with its label in the legend, and "none done" also carries an ✕.
const CELL_STATES = {
  done: { label: 'All done', className: 'bg-[#0ca30c]' },
  partial: { label: 'Some missed', className: 'bg-[#fab219]' },
  none: { label: 'None done', className: 'bg-[#d03b3b]' },
  open: { label: 'In progress', className: 'bg-[#cde2fb]' },
  notDue: { label: 'Not due', className: 'bg-slate-100' },
};

const formatRate = (rate) => (rate == null ? '—' : `${roundRate(rate)}%`);
const rateClass = (rate) => (rate == null ? 'text-slate-400' : rate >= COMPLETION_TARGET ? 'text-green-600' : 'text-red-600');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// One line per bar label, cut short (full text on hover) rather than
// wrapped onto a second line.
function BarLabelTick({ x, y, payload, maxChars }) {
  const text = String(payload.value);
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={INK.text}>
      <title>{text}</title>
      {shorten(text, maxChars)}
    </text>
  );
}

function StatTile({ label, value, note, valueClassName = 'text-slate-900' }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${valueClassName}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

// A row of buttons, one of them picked — options: [{ value, label }].
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${value === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const TREND_VIEWS = [{ value: 'line', label: 'Line' }, { value: 'bar', label: 'Bar' }];
// The bar view keeps each day's bars at least this wide (one per brand) and
// scrolls sideways past what fits, rather than squeezing them to slivers.
const MIN_BAR = 8;
const BAR_GAP = 2;
const DAY_GAP = 14;
// The lowest-completion chart starts with this many stores; "Show all"
// scrolls the rest within that same height rather than growing the card.
const LOWEST_SHOWN = 10;
const LOWEST_ROW_H = 28;
// Completion by store: a brand with more stores than this scrolls inside
// its own box (about this many rows tall) instead of stretching the page.
const GRID_ROWS_SHOWN = 20;
const GRID_ROW_H = 33;
const GRID_HEAD_H = 37;
const isOnTarget = (row) => row.rate != null && row.rate >= COMPLETION_TARGET;
const isBelowTarget = (row) => row.rate != null && row.rate < COMPLETION_TARGET;

function TrendTooltip({ active, payload, series }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-700">{moment(row.day).format('ddd, MMM D, YYYY')}</p>
      {series.map((s, i) => {
        const stat = row.stats[i];
        if (!stat?.required) return null;
        return (
          <div key={s.name} className="flex items-center gap-2 py-0.5">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-bold tabular-nums text-slate-900">{formatRate(stat.rate)}</span>
            <span className="text-slate-500">{s.name} · {stat.done} of {stat.required} done</span>
          </div>
        );
      })}
    </div>
  );
}

function BarTooltip({ active, payload, describe }) {
  if (!active || !payload?.length) return null;
  const { title, lines } = describe(payload[0].payload);
  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-700">{title}</p>
      {lines.map(line => <p key={line} className="text-slate-600">{line}</p>)}
    </div>
  );
}

const describeStore = (row) => ({
  title: `${row.storeName} · ${row.brandName}`,
  lines: [`${formatRate(row.rate)} complete`, `${row.done} of ${row.required} done · ${row.missed} missed`],
});
const describeChecklist = (row) => ({
  title: row.title,
  lines: [`Missed ${plural(row.missed, 'time')}`, `${row.done} of ${row.required} done (${formatRate(row.rate)}) · ${plural(row.stores, 'store')}`],
});

// What a grid day says when pointed at or tapped.
function describeCell({ row, cell }) {
  const where = `${moment(cell.day).format('ddd, MMM D')} · ${row.storeName} (${row.brandName})`;
  if (!cell.required) return `${where} — nothing due yet.`;
  if (cell.done === cell.required) return `${where} — all ${cell.required} done.`;
  const names = cell.missing.map(t => t.title).join(', ');
  return cell.open
    ? `${where} — ${cell.done} of ${cell.required} done so far. Still open: ${names}.`
    : `${where} — ${cell.done} of ${cell.required} done. Missed: ${names}.`;
}

function CellSwatch({ state, className = 'h-4 w-4' }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[3px] ${className} ${CELL_STATES[state].className}`}>
      {state === 'none' && <X className="h-3 w-3 text-white" strokeWidth={3} />}
    </span>
  );
}

export default function ChecklistCompletionCard({
  templates,
  completion,
  // Every brand in a fixed order — it decides each brand's line color.
  brandNames = [],
  isAdmin = false,
  selectedIds = [],
  onToggle,
  onSelectAll,
  onClearAll,
  saving = false,
  // While the caller's submissions are still loading, show a spinner rather
  // than a 0% rate that would only be corrected once the data arrives.
  loading = false,
  // The caller hit its row limit, so the earliest days are incomplete.
  capped = false,
}) {
  const [showManager, setShowManager] = useState(false);
  const [trendView, setTrendView] = useState('line');
  // A brand picked in the legend stays in color; the rest go gray.
  const [highlighted, setHighlighted] = useState(null);
  const [pointed, setPointed] = useState(null);
  const [showAllBelow, setShowAllBelow] = useState(false);
  // Completion by store: 'all', 'below' or 'onTarget'.
  const [storeFilter, setStoreFilter] = useState('all');
  // A new range or filter rebuilds the grid — drop the old day's details.
  useEffect(() => { setPointed(null); }, [completion]);

  const { days, daily, brands, stores, checklists, totals, inProgress } = completion;
  const hasActive = templates.some(t => selectedIds.includes(t.id));
  const hasFinished = totals.required > 0;

  const series = useMemo(
    () => brands.map(b => ({ name: b.brandName, color: brandSeriesColor(b.brandName, brandNames) })),
    [brands, brandNames]
  );

  // Finished days only — today would show as a dip just because its later
  // checklists aren't due yet.
  const trendData = useMemo(() => daily
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => !d.open && d.required > 0)
    .map(({ d, i }) => {
      const stats = brands.map(b => b.daily[i]);
      return {
        day: d.day,
        label: moment(d.day).format('MMM D'),
        overall: d,
        stats,
        rates: stats.map(s => (s.required ? roundRate(s.rate) : null)),
      };
    }), [daily, brands]);

  // Stores short of the target, lowest completion first.
  const storesBelowTarget = useMemo(() => stores
    .filter(isBelowTarget)
    .sort((a, b) => a.rate - b.rate || b.missed - a.missed || a.storeName.localeCompare(b.storeName))
    .map(s => ({ ...s, rateValue: roundRate(s.rate) })), [stores]);
  const lowestShown = showAllBelow ? storesBelowTarget : storesBelowTarget.slice(0, LOWEST_SHOWN);

  // The store grid, narrowed by the filter; brands with no store left drop out.
  const gridBrands = useMemo(() => {
    const keep = storeFilter === 'below' ? isBelowTarget : storeFilter === 'onTarget' ? isOnTarget : () => true;
    return brands.map(b => ({ ...b, shown: b.stores.filter(keep) })).filter(b => b.shown.length);
  }, [brands, storeFilter]);
  const storeFilters = [
    { value: 'all', label: `All stores (${stores.length})` },
    { value: 'below', label: `Below target (${stores.filter(isBelowTarget).length})` },
    { value: 'onTarget', label: `On target (${stores.filter(isOnTarget).length})` },
  ];

  const mostMissed = useMemo(() => checklists.filter(c => c.missed > 0).slice(0, 10), [checklists]);

  if (templates.length === 0) return null;

  const singleStore = stores.length === 1 ? stores[0] : null;
  const trendTitle = singleStore
    ? `Daily completion — ${singleStore.storeName}`
    : series.length === 1 ? `Daily completion — ${series[0].name}` : 'Daily completion by brand';
  const showDots = trendData.length <= 14;
  const trendScale = completionRateScale(trendData.flatMap(row => row.rates.filter(rate => rate != null)));
  const focusName = series.some(s => s.name === highlighted) ? highlighted : null;
  // The highlighted brand is drawn last, on top of the gray ones.
  const drawOrder = series.map((s, i) => ({ ...s, i })).sort((a, b) => (a.name === focusName) - (b.name === focusName));
  const seriesColor = (s) => (focusName && focusName !== s.name ? INK.axis : s.color);
  const barChartMinWidth = trendData.length * (series.length * (MIN_BAR + BAR_GAP) + DAY_GAP) + 60;
  const openStoreCount = stores.filter(s => s.cells.some(c => c.open && c.done < c.required)).length;
  const gridStates = inProgress ? Object.keys(CELL_STATES) : Object.keys(CELL_STATES).filter(k => k !== 'open');

  return (
    <>
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-bold text-slate-800 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-[#1fd655]" /> Checklist Completion
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Every checklist assigned to a store is due once a day. Rates count finished days; target {COMPLETION_TARGET}%.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold border-slate-300 self-start"
              onClick={() => setShowManager(s => !s)}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />}
              Manage Checklists
              {showManager ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          )}
        </CardHeader>

        {isAdmin && showManager && (
          <CardContent className="px-5 pt-0 pb-4">
            <div className="border border-slate-200 rounded-lg bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Select which checklists count toward completion ({selectedIds.length} of {templates.length} selected)
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectAll} disabled={saving}>Select All</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll} disabled={saving}>Clear All</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {templates.map(t => (
                  <label key={t.id} className="flex items-center gap-2.5 p-2 rounded-md bg-white border border-slate-200 hover:border-[#1fd655] cursor-pointer transition-colors">
                    <Checkbox
                      checked={selectedIds.includes(t.id)}
                      onCheckedChange={() => onToggle(t.id)}
                      disabled={saving}
                    />
                    <span className="text-sm text-slate-700 font-medium truncate">{t.title}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400">This selection applies to all store users' completion rate. QA audit templates are excluded by default.</p>
            </div>
          </CardContent>
        )}

        <CardContent className="px-5 pb-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !hasActive ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No checklists count toward completion yet.{isAdmin ? ' Pick them under Manage Checklists.' : ''}
            </p>
          ) : stores.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">None of these checklists is assigned to a store in this selection.</p>
          ) : (
            <>
              {capped && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>This range has more checklists than the dashboard loads at once, so its earliest days are incomplete and their checklists show as missed. Pick a shorter range or one brand for exact numbers.</span>
                </div>
              )}
              {hasFinished ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile label="Average completion" value={formatRate(totals.rate)} valueClassName={rateClass(totals.rate)} note={`Target ${COMPLETION_TARGET}%`} />
                  <StatTile label="Checklists done" value={totals.done.toLocaleString()} note={`of ${totals.required.toLocaleString()} due`} />
                  <StatTile label="Checklists missed" value={totals.missed.toLocaleString()} valueClassName={totals.missed ? 'text-red-600' : 'text-slate-900'} note={`${roundRate(100 - (totals.rate ?? 100))}% of those due`} />
                  <StatTile label="Stores below target" value={totals.belowTarget} valueClassName={totals.belowTarget ? 'text-red-600' : 'text-slate-900'} note={`of ${plural(totals.stores, 'store')}`} />
                </div>
              ) : inProgress && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile label="Done so far" value={formatRate(inProgress.required ? (inProgress.done / inProgress.required) * 100 : null)} note="Today, still in progress" />
                  <StatTile label="Checklists done" value={inProgress.done.toLocaleString()} note={`of ${inProgress.required.toLocaleString()} due`} />
                  <StatTile label="Still open" value={inProgress.open.toLocaleString()} note="Not missed until the day ends" />
                  <StatTile label="Stores with open checklists" value={openStoreCount} note={`of ${plural(totals.stores, 'store')}`} />
                </div>
              )}
              {hasFinished && inProgress && (
                <p className="text-xs text-slate-500">
                  In progress: {inProgress.done.toLocaleString()} of {inProgress.required.toLocaleString()} done so far today, {inProgress.open.toLocaleString()} still open — counted once the day ends.
                </p>
              )}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">{trendTitle}</p>
                  {trendData.length > 0 && <Segmented options={TREND_VIEWS} value={trendView} onChange={setTrendView} />}
                </div>
                {trendData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">The trend covers finished days — pick a date range that includes days before today.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      {series.length > 1 && series.map(s => (
                        <button
                          key={s.name}
                          type="button"
                          aria-pressed={focusName === s.name}
                          onClick={() => setHighlighted(h => (h === s.name ? null : s.name))}
                          className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-opacity hover:bg-slate-100 ${focusName && focusName !== s.name ? 'opacity-50' : ''} ${focusName === s.name ? 'font-semibold text-slate-900' : ''}`}
                        >
                          <span className={trendView === 'bar' ? 'h-2.5 w-2.5 rounded-[2px]' : 'h-0.5 w-4 rounded-full'} style={{ backgroundColor: s.color }} />{s.name}
                        </button>
                      ))}
                      <span className="inline-flex items-center gap-1.5 px-1 text-slate-500">
                        <span className="h-px w-4" style={{ backgroundColor: INK.muted }} />Target {COMPLETION_TARGET}%
                      </span>
                      {series.length > 1 && <span className="text-slate-400">Click a brand to highlight it.</span>}
                    </div>
                    {trendView === 'line' ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke={INK.grid} vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK.text }} tickLine={false} axisLine={{ stroke: INK.axis }} minTickGap={16} />
                          <YAxis domain={trendScale.domain} ticks={trendScale.ticks} allowDataOverflow tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: INK.text }} tickLine={false} axisLine={false} width={44} />
                          <ReferenceLine y={COMPLETION_TARGET} stroke={INK.muted} />
                          <Tooltip content={<TrendTooltip series={series} />} cursor={{ stroke: INK.axis, strokeWidth: 1 }} />
                          {drawOrder.map(s => {
                            const color = focusName && focusName !== s.name ? INK.axis : s.color;
                            return (
                              <Line
                                key={s.name}
                                type="linear"
                                dataKey={row => row.rates[s.i]}
                                name={s.name}
                                stroke={color}
                                strokeWidth={2}
                                dot={showDots ? { r: 4, fill: color, stroke: '#fff', strokeWidth: 2 } : false}
                                activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                                isAnimationActive={false}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      // Bars start at 0% — a bar cut off above zero would
                      // exaggerate the gaps. Long ranges scroll sideways.
                      <div className="overflow-x-auto">
                        <div style={{ minWidth: barChartMinWidth }}>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={BAR_GAP} barCategoryGap={DAY_GAP / 2}>
                              <CartesianGrid stroke={INK.grid} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK.text }} tickLine={false} axisLine={{ stroke: INK.axis }} minTickGap={8} />
                              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: INK.text }} tickLine={false} axisLine={false} width={44} />
                              <Tooltip content={<TrendTooltip series={series} />} cursor={{ fill: INK.grid, fillOpacity: 0.5 }} />
                              {series.map((s, i) => (
                                <Bar
                                  key={s.name}
                                  dataKey={row => row.rates[i]}
                                  name={s.name}
                                  fill={seriesColor(s)}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={24}
                                  isAnimationActive={false}
                                />
                              ))}
                              <ReferenceLine y={COMPLETION_TARGET} stroke={INK.muted} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!loading && hasActive && hasFinished && stores.length > 1 && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><Store className="h-4 w-4 text-[#1fd655]" /> Lowest completion — stores</p>
              <p className="text-xs text-slate-500">
                {storesBelowTarget.length
                  ? `${plural(storesBelowTarget.length, 'store')} below the ${COMPLETION_TARGET}% target, lowest first${storesBelowTarget.length > LOWEST_SHOWN ? (showAllBelow ? ' — scroll to see them all' : ` — showing the lowest ${LOWEST_SHOWN}`) : ''}.`
                  : `Stores below the ${COMPLETION_TARGET}% target, lowest first.`}
              </p>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              {storesBelowTarget.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Every store completed all its checklists in this range.</p>
              ) : (
                <>
                  {/* Every value is labeled at its bar, so no axis. */}
                  <div className="overflow-y-auto pr-1" style={{ maxHeight: LOWEST_SHOWN * LOWEST_ROW_H + 8 }}>
                    <ResponsiveContainer width="100%" height={lowestShown.length * LOWEST_ROW_H + 8}>
                      <BarChart data={lowestShown} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis type="category" dataKey="storeName" width={150} interval={0} tick={<BarLabelTick maxChars={24} />} tickLine={false} axisLine={{ stroke: INK.axis }} />
                        <Tooltip content={<BarTooltip describe={describeStore} />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                        <Bar dataKey="rateValue" fill={BAR_COLOR} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                          <LabelList dataKey="rateValue" position="right" formatter={v => `${v}%`} style={{ fontSize: 11, fill: INK.text }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {storesBelowTarget.length > LOWEST_SHOWN && (
                    <div className="px-3 pt-3">
                      <Button variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-300" onClick={() => setShowAllBelow(v => !v)}>
                        {showAllBelow ? `Show the lowest ${LOWEST_SHOWN}` : `Show all ${storesBelowTarget.length}`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <p className="font-bold text-slate-800 flex items-center gap-2"><ListX className="h-4 w-4 text-[#1fd655]" /> Most missed checklists</p>
              <p className="text-xs text-slate-500">How many times each checklist was due but not done, across all stores in this range.</p>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              {mostMissed.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No checklist was missed in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={mostMissed.length * 34 + 32}>
                  <BarChart data={mostMissed} layout="vertical" margin={{ top: 0, right: 48, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={INK.grid} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: INK.text }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="title" width={200} interval={0} tick={<BarLabelTick maxChars={32} />} tickLine={false} axisLine={{ stroke: INK.axis }} />
                    <Tooltip content={<BarTooltip describe={describeChecklist} />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                    <Bar dataKey="missed" fill={BAR_COLOR} barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      <LabelList dataKey="missed" position="right" style={{ fontSize: 11, fill: INK.text }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && hasActive && stores.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-bold text-slate-800 flex items-center gap-2"><Store className="h-4 w-4 text-[#1fd655]" /> Completion by store</p>
              <p className="text-xs text-slate-500">Each square is one day. Open a brand to see its stores; point at or tap a day for what was missed.</p>
            </div>
            {hasFinished && <Segmented options={storeFilters} value={storeFilter} onChange={setStoreFilter} />}
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {gridStates.map(state => (
                <span key={state} className="inline-flex items-center gap-1.5"><CellSwatch state={state} className="h-3.5 w-3.5" />{CELL_STATES[state].label}</span>
              ))}
            </div>
            <p className="min-h-[2.5rem] rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700" aria-live="polite">
              {pointed ? describeCell(pointed) : 'Point at or tap a day to see which checklists were done or missed.'}
            </p>
            {gridBrands.length === 0 && (
              <p className="rounded-lg border border-slate-200 py-8 text-center text-sm text-slate-400">
                {storeFilter === 'below' ? 'No store is below target — every store completed all its checklists.' : `No store reached the ${COMPLETION_TARGET}% target in this range.`}
              </p>
            )}
            {/* The first brand starts open; a different set of brands
                (another filter) starts fresh with its own first one open. */}
            <Accordion
              key={`${storeFilter}|${gridBrands.map(b => b.brandName).join('|')}`}
              type="multiple"
              defaultValue={gridBrands.length ? [gridBrands[0].brandName] : []}
              className={gridBrands.length ? 'rounded-lg border border-slate-200 divide-y divide-slate-100' : 'hidden'}
            >
              {gridBrands.map(brand => (
                <AccordionItem key={brand.brandName} value={brand.brandName} className="border-0">
                  <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                    <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-3">
                      <span className="text-sm font-semibold text-slate-800">{brand.brandName}</span>
                      <span className="text-xs text-slate-400">
                        {storeFilter === 'all' ? plural(brand.stores.length, 'store') : `${brand.shown.length} of ${plural(brand.stores.length, 'store')}`}
                      </span>
                      {brand.belowTarget > 0 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{brand.belowTarget} below target</span>
                      )}
                      <span className={`ml-auto text-sm font-bold tabular-nums ${rateClass(brand.rate)}`}>{formatRate(brand.rate)}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-2">
                    {/* Past GRID_ROWS_SHOWN stores the table scrolls in its own
                        box; the day numbers and store names stay in view. */}
                    <div
                      className="overflow-auto"
                      style={brand.shown.length > GRID_ROWS_SHOWN ? { maxHeight: `min(${GRID_HEAD_H + GRID_ROWS_SHOWN * GRID_ROW_H}px, 70vh)` } : undefined}
                    >
                      <table className="text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="sticky left-0 top-0 z-30 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_#f1f5f9]">Store</th>
                            {days.map((day, i) => (
                              <th key={day} className="sticky top-0 z-20 bg-slate-50 px-0 py-2 text-center text-[10px] font-medium text-slate-400 shadow-[inset_0_-1px_0_#f1f5f9]" title={moment(day).format('ddd, MMM D, YYYY')}>
                                {days.length <= 31 || i % 7 === 0 ? moment(day).format('D') : ''}
                              </th>
                            ))}
                            <th className="sticky top-0 z-20 bg-slate-50 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_#f1f5f9]">Done</th>
                            <th className="sticky top-0 z-20 bg-slate-50 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_#f1f5f9]">Missed</th>
                            <th className="sticky top-0 z-20 bg-slate-50 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_#f1f5f9]">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {brand.shown.map(row => (
                            <tr key={row.store.id || row.storeName} className="border-b border-slate-100 last:border-0">
                              <td className="sticky left-0 z-10 max-w-[180px] truncate bg-white px-3 py-1.5 font-medium text-slate-800" title={row.storeName}>{row.storeName}</td>
                              {row.cells.map(cell => {
                                const state = completionCellState(cell);
                                const isPointed = pointed?.row === row && pointed?.cell === cell;
                                return (
                                  <td key={cell.day} className="p-0">
                                    <button
                                      type="button"
                                      aria-label={`${moment(cell.day).format('MMM D')}: ${cell.done} of ${cell.required} done`}
                                      onMouseEnter={() => setPointed({ row, cell })}
                                      onFocus={() => setPointed({ row, cell })}
                                      onClick={() => setPointed({ row, cell })}
                                      className={`flex rounded-[4px] p-[2px] ${isPointed ? 'ring-2 ring-slate-900' : ''}`}
                                    >
                                      <CellSwatch state={state} />
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{row.done}</td>
                              <td className={`px-3 py-1.5 text-right tabular-nums ${row.missed ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{row.missed}</td>
                              <td className={`px-3 py-1.5 text-right font-bold tabular-nums ${rateClass(row.rate)}`}>{formatRate(row.rate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {brand.shown.length > GRID_ROWS_SHOWN && (
                      <p className="px-3 pt-2 text-xs text-slate-400">{brand.shown.length} stores — scroll the list to see them all.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </>
  );
}
