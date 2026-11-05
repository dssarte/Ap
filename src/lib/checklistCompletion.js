import moment from 'moment';
import { auditBusinessDayKey } from '@/lib/dateUtils';
import { templateAppliesToStore } from '@/lib/auditTemplateMatch';

// A store is on target only when every checklist due was done.
export const COMPLETION_TARGET = 100;

// Brand lines and bars take the validated categorical palette, one slot per
// brand by its place in the full brand list, so a brand keeps its color
// whatever the filters — on screen and in the PDF.
export const BRAND_SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const brandSeriesColor = (brandName, brandNames) => BRAND_SERIES_COLORS[brandNames.indexOf(brandName)] ?? '#94a3b8';

// 92.4 — completion rates keep one decimal. A rate short of 100% never
// rounds up to show as 100% (2,399 of 2,400 is 99.9%), since only a full
// 100% meets the target.
export const roundRate = (rate) => (rate == null ? null : Math.min(Math.round(rate * 10) / 10, rate < 100 ? 99.9 : 100));

// The rate axis of a completion trend: from a little below the lowest
// value (or the target, whichever is lower) up to 100%, so close brands
// don't all bunch at the top.
export function completionRateScale(values) {
  const low = Math.min(COMPLETION_TARGET, ...values);
  const min = Math.max(0, Math.floor((low - 5) / 10) * 10);
  const step = 100 - min > 50 ? 25 : 10;
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= 100; t += step) ticks.push(t);
  return { domain: [min, 100], ticks };
}

const rateOf = (done, required) => (required > 0 ? (done / required) * 100 : null);

// How one store's day reads on the completion grid: 'done', 'partial',
// 'none', 'open' (still in progress) or 'notDue' (nothing assigned yet).
export function completionCellState(cell) {
  if (!cell.required) return 'notDue';
  if (cell.done === cell.required) return 'done';
  if (cell.open) return 'open';
  return cell.done === 0 ? 'none' : 'partial';
}

function daysInRange(dateFrom, dateTo) {
  const days = [];
  const cur = moment(dateFrom, 'YYYY-MM-DD', true);
  const end = moment(dateTo, 'YYYY-MM-DD', true);
  if (!cur.isValid() || !end.isValid()) return days;
  while (cur.isSameOrBefore(end, 'day')) {
    days.push(cur.format('YYYY-MM-DD'));
    cur.add(1, 'day');
  }
  return days;
}

// A checklist or store counts from the business day it was added, so one
// introduced mid-range isn't held against the days before it existed.
const startDayOf = (record) => (record?.created_date ? auditBusinessDayKey(record.created_date) : '');

const totalsOf = (cells) => {
  const required = cells.reduce((sum, c) => sum + c.required, 0);
  const done = cells.reduce((sum, c) => sum + c.done, 0);
  return { required, done, missed: required - done, rate: rateOf(done, required) };
};

/**
 * Checklist completion per store per business day — every assigned
 * checklist is due once a day.
 *
 * Today is still under way, and so is yesterday until 5 AM while its
 * closing checklists can come in: a checklist not done yet on those days is
 * open, not missed. Rates, done/missed counts and every ranking cover the
 * finished days only; the open days are summed up in `inProgress`. Days
 * after today aren't counted at all.
 *
 * stores        store records — { id, store_name, brand_id, brand_name, created_date }
 * templates     the checklists that count, each due daily wherever it applies
 * submissions   finalized checklists — { template_id, template_title, brand, submission_date }
 * brandNameById each brand's current name, ahead of the copy saved on the store
 */
export function computeCompletion({ stores, templates, submissions, dateFrom, dateTo, brandNameById = new Map(), now = new Date() }) {
  const today = auditBusinessDayKey(now);
  const openFrom = auditBusinessDayKey(now, 'Closing');
  const days = daysInRange(dateFrom, dateTo < today ? dateTo : today);
  const isOpen = days.map(day => day >= openFrom);
  const finishedDays = days.filter((_, i) => !isOpen[i]);

  // Grouped by store label ("Brand - Store, Location") with each row's
  // business day worked out once, so a store checks the few distinct
  // labels rather than every submission.
  const byLabel = new Map();
  submissions.forEach(s => {
    const label = s.brand || '';
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push({ day: auditBusinessDayKey(s), templateId: s.template_id });
  });

  const templateStart = new Map(templates.map(t => [t.id, startDayOf(t)]));

  const storeRows = [];
  stores.forEach(store => {
    const assigned = templates.filter(t => templateAppliesToStore(t, store));
    if (!assigned.length) return;
    const storeStart = startDayOf(store);
    const doneByDay = new Map();
    byLabel.forEach((rows, label) => {
      if (!label.includes(store.store_name)) return;
      rows.forEach(({ day, templateId }) => {
        if (!doneByDay.has(day)) doneByDay.set(day, new Set());
        doneByDay.get(day).add(templateId);
      });
    });
    const cells = days.map((day, i) => {
      const due = day < storeStart ? [] : assigned.filter(t => templateStart.get(t.id) <= day);
      const doneIds = doneByDay.get(day);
      const missing = due.filter(t => !doneIds?.has(t.id));
      return { day, required: due.length, done: due.length - missing.length, missing, open: isOpen[i] };
    });
    const finished = cells.filter(c => !c.open);
    storeRows.push({
      store,
      storeName: store.store_name,
      brandName: brandNameById.get(store.brand_id) || store.brand_name || 'Other',
      cells,
      assigned,
      ...totalsOf(finished),
      daysAllDone: finished.filter(c => c.required > 0 && c.done === c.required).length,
      daysWithMisses: finished.filter(c => c.done < c.required).length,
    });
  });
  storeRows.sort((a, b) => a.brandName.localeCompare(b.brandName) || a.storeName.localeCompare(b.storeName));

  const finishedCells = (rows) => rows.flatMap(r => r.cells.filter(c => !c.open));
  const dayTotals = (rows, i) => totalsOf(rows.map(r => r.cells[i]));

  const brandMap = new Map();
  storeRows.forEach(row => {
    if (!brandMap.has(row.brandName)) brandMap.set(row.brandName, []);
    brandMap.get(row.brandName).push(row);
  });
  const brandRows = Array.from(brandMap, ([brandName, rows]) => ({
    brandName,
    stores: rows,
    ...totalsOf(finishedCells(rows)),
    belowTarget: rows.filter(r => r.rate != null && r.rate < COMPLETION_TARGET).length,
    daily: days.map((day, i) => ({ day, open: isOpen[i], ...dayTotals(rows, i) })),
  }));

  const daily = days.map((day, i) => ({ day, open: isOpen[i], ...dayTotals(storeRows, i) }));

  // Per checklist, across every store it's assigned to.
  const checklistMap = new Map();
  storeRows.forEach(row => {
    row.assigned.forEach(t => {
      if (!checklistMap.has(t.id)) checklistMap.set(t.id, { template: t, stores: 0, required: 0, done: 0 });
      checklistMap.get(t.id).stores += 1;
    });
    row.cells.forEach(cell => {
      if (cell.open || !cell.required) return;
      const missingIds = new Set(cell.missing.map(t => t.id));
      row.assigned.forEach(t => {
        if (templateStart.get(t.id) > cell.day) return;
        const entry = checklistMap.get(t.id);
        entry.required += 1;
        if (!missingIds.has(t.id)) entry.done += 1;
      });
    });
  });
  const checklistRows = Array.from(checklistMap.values())
    .map(entry => ({ ...entry, title: entry.template.title, missed: entry.required - entry.done, rate: rateOf(entry.done, entry.required) }))
    .sort((a, b) => b.missed - a.missed || a.title.localeCompare(b.title));

  const openTotals = totalsOf(storeRows.flatMap(r => r.cells.filter(c => c.open)));

  return {
    days,
    finishedDays,
    stores: storeRows,
    brands: brandRows,
    daily,
    checklists: checklistRows,
    totals: {
      ...totalsOf(finishedCells(storeRows)),
      stores: storeRows.length,
      belowTarget: storeRows.filter(r => r.rate != null && r.rate < COMPLETION_TARGET).length,
    },
    inProgress: isOpen.some(Boolean)
      ? { required: openTotals.required, done: openTotals.done, open: openTotals.missed }
      : null,
  };
}
