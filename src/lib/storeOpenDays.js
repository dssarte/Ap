// Which days a store is open — stores.open_days: ISO weekday numbers
// (1 = Monday … 7 = Sunday). Not set means open every day, as every store
// was before open days existed. A day the store is closed has no checklists
// due, so it never counts as missed or against its completion rate.
export const WEEKDAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 7, short: 'Sun' },
];
export const EVERY_DAY = WEEKDAYS.map(day => day.value);

export const isEveryDay = (days) => EVERY_DAY.every(day => days.includes(day));

// The weekdays a store is open, in order — every day when not set.
export function storeOpenDays(store) {
  const days = Array.isArray(store?.open_days)
    ? [...new Set(store.open_days.map(Number))].filter(day => day >= 1 && day <= 7).sort((a, b) => a - b)
    : [];
  return days.length ? days : EVERY_DAY;
}

// What to save for a set of open days: null for every day.
export const openDaysValue = (days) => (isEveryDay(days) ? null : [...days].sort((a, b) => a - b));

// The ISO weekday of a business day ('YYYY-MM-DD').
export function weekdayOf(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function isStoreOpenOn(store, day) {
  const days = storeOpenDays(store);
  return isEveryDay(days) || days.includes(weekdayOf(day));
}

// "Every day", "Mon–Fri", "Mon–Sat", "Sat, Sun", "Mon, Wed, Fri"…
export function describeOpenDays(days) {
  if (isEveryDay(days)) return 'Every day';
  const runs = [];
  [...days].sort((a, b) => a - b).forEach(day => {
    const last = runs[runs.length - 1];
    if (last && day === last[1] + 1) last[1] = day;
    else runs.push([day, day]);
  });
  const name = (day) => WEEKDAYS[day - 1].short;
  return runs
    .map(([from, to]) => (from === to ? name(from) : to === from + 1 ? `${name(from)}, ${name(to)}` : `${name(from)}–${name(to)}`))
    .join(', ');
}
