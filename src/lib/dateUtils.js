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

/**
 * Whether the current time in Asia/Manila falls within a HH:MM–HH:MM window.
 * Supports windows that cross midnight (e.g. 22:00–06:00) the same way audit
 * template time restrictions do. An equal start/end means "always active".
 */
export function isTimeWithinWindow(startTime, endTime, now = new Date()) {
  if (!startTime || !endTime) return true;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const getPart = (type) => Number(parts.find(part => part.type === type)?.value);
  const nowMinutes = getPart('hour') * 60 + getPart('minute');

  const [fh, fm] = startTime.split(':').map(Number);
  const [th, tm] = endTime.split(':').map(Number);
  const fromMinutes = fh * 60 + fm;
  const toMinutes = th * 60 + tm;
  if (fromMinutes === toMinutes) return true;
  if (fromMinutes < toMinutes) return nowMinutes >= fromMinutes && nowMinutes <= toMinutes;
  return nowMinutes >= fromMinutes || nowMinutes <= toMinutes;
}

export function isClosingAudit(templateTitle) {
  return /\bclosing\b/i.test(String(templateTitle || ''));
}

/**
 * Operational reporting date for an audit in Asia/Manila.
 * Closing audits submitted from midnight through 4:59:59 AM belong to the
 * previous day. Exactly 5:00 AM begins the new reporting day.
 */
export function auditBusinessDayKey(submissionOrDate, templateTitle = '') {
  const submission = submissionOrDate
    && typeof submissionOrDate === 'object'
    && !(submissionOrDate instanceof Date)
    ? submissionOrDate
    : null;
  const value = submission
    ? submission.submission_date || submission.created_date
    : submissionOrDate;
  const title = submission?.template_title || templateTitle;
  const date = safeDate(value);
  if (!date) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const getPart = (type) => parts.find(part => part.type === type)?.value;
  const year = Number(getPart('year'));
  const month = Number(getPart('month'));
  const day = Number(getPart('day'));
  const hour = Number(getPart('hour'));

  if (![year, month, day, hour].every(Number.isFinite)) return '';

  const businessDate = new Date(Date.UTC(year, month - 1, day));
  if (isClosingAudit(title) && hour < 5) {
    businessDate.setUTCDate(businessDate.getUTCDate() - 1);
  }

  return [
    businessDate.getUTCFullYear(),
    String(businessDate.getUTCMonth() + 1).padStart(2, '0'),
    String(businessDate.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
