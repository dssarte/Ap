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
