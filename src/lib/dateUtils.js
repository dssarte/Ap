export const PH_TIMEZONE = 'Asia/Manila';

export function safeDate(value) {
  if (!value) return null;
  const normalized = typeof value === 'string' && !/Z$|[+-]\d{2}:?\d{2}$/.test(value)
    ? `${value}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWith(value, options, fallback = 'Date unavailable') {
  const date = safeDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat('en-PH', { timeZone: PH_TIMEZONE, ...options }).format(date);
  } catch {
    return fallback;
  }
}

export function formatPHDateTime(value) {
  return formatWith(value, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
export function formatPHDate(value) {
  return formatWith(value, { year: 'numeric', month: 'short', day: 'numeric' });
}
export function formatPHDateShort(value) {
  return formatWith(value, { year: 'numeric', month: 'numeric', day: 'numeric' });
}
export function formatPHMonthYear(value) {
  return formatWith(value, { month: 'short', year: '2-digit' });
}
