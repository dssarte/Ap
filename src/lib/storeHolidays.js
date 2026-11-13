import moment from 'moment';

// Holidays and one-off closures — public.store_holidays, managed by admins in
// Administration › Holidays: { name, date_from, date_to, all_stores,
// store_ids }. On a store's holiday no checklist is due, so completion shows
// the day as a holiday and leaves it out of the store's rate and missed
// counts, the same as a day the store doesn't open.

// The holiday a store has on a business day ('YYYY-MM-DD'), or null.
export function holidayOn(holidays, store, day) {
  if (!holidays?.length || !store) return null;
  return holidays.find(h => h.date_from <= day && day <= h.date_to
    && (h.all_stores || (Array.isArray(h.store_ids) && h.store_ids.includes(store.id)))) || null;
}

// "Dec 25, 2026", "Dec 24 – 26, 2026", "Dec 31, 2026 – Jan 1, 2027".
export function describeHolidayDates(holiday) {
  const from = moment(holiday.date_from, 'YYYY-MM-DD');
  const to = moment(holiday.date_to || holiday.date_from, 'YYYY-MM-DD');
  if (from.isSame(to, 'day')) return from.format('MMM D, YYYY');
  if (from.isSame(to, 'month')) return `${from.format('MMM D')} – ${to.format('D, YYYY')}`;
  if (from.isSame(to, 'year')) return `${from.format('MMM D')} – ${to.format('MMM D, YYYY')}`;
  return `${from.format('MMM D, YYYY')} – ${to.format('MMM D, YYYY')}`;
}
