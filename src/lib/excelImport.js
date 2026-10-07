// xlsx is a large library and only a handful of QA staff ever use the
// import flow — loaded on demand (inside readWorkbook) instead of at the
// top of the module so it doesn't bloat everyone else's initial bundle.

// Mirrors the Python normalization used to build these templates from
// their source spreadsheets in the first place — strips non-breaking
// spaces, normalizes curly quotes/whitespace, drops a trailing period, and
// lowercases, so a label matches regardless of minor formatting drift
// between the blank template and a specific completed copy.
function normalizeLabel(value) {
  return String(value ?? '')
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '');
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

// 1.0 = identical, 0.0 = nothing in common. Used only as a fallback once
// an exact normalized match fails (wording drift between the source
// template and a specific completed copy — a fixed typo, a re-typed
// space) — never to pick between two genuinely different requirements.
function similarityRatio(a, b) {
  if (!a && !b) return 1;
  const longer = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / longer;
}

async function readWorkbook(file) {
  const XLSX = await import('xlsx');
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.readAsArrayBuffer(file);
  });
  return { XLSX, workbook: XLSX.read(buffer, { type: 'array', cellDates: true }) };
}

function sheetToGrid(XLSX, ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

const HEADER_WORDS = { yes: 'YES', no: 'NO', na: 'NA', remarks: null };

function findHeaderColumns(row) {
  if (!Array.isArray(row)) return null;
  const cols = {};
  row.forEach((cell, idx) => {
    if (typeof cell !== 'string') return;
    const v = cell.trim().toUpperCase();
    if (v === 'YES') cols.yes = idx;
    else if (v === 'NO') cols.no = idx;
    else if (v === 'NA' || v === 'N/A') cols.na = idx;
    else if (v.includes('REMARK') || v.includes('FINDING')) cols.remarks = idx;
  });
  return (cols.yes != null && cols.no != null && cols.na != null) ? cols : null;
}

// Parses one worksheet (already known to belong to `template`) into an
// answers map, matching each sheet row to a template item by label text —
// exact match first, a high-similarity fallback second — then reading
// whichever of that row's Yes/No/NA columns actually has a value in it.
// Mystery shopper sheets mark an answer by copying the item's own point
// value into the matching column (never a fixed "X"), so "has any
// non-empty value" is the right test, not matching a specific mark.
export function parseAnswersFromSheet(XLSX, ws, template) {
  const grid = sheetToGrid(XLSX, ws);
  const allItems = (template.sections || []).flatMap(s => s.items || []);

  const byLabel = new Map();
  allItems.forEach(item => {
    const key = normalizeLabel(item.label);
    if (!byLabel.has(key)) byLabel.set(key, []);
    byLabel.get(key).push(item);
  });

  const answers = {};
  const noComments = {};
  const matchedIds = new Set();
  let cols = null;
  const candidateRows = []; // {label, rowIdx} for rows that found no exact match, for fuzzy fallback

  grid.forEach((row, rowIdx) => {
    if (!Array.isArray(row) || row.length === 0) return;
    const found = findHeaderColumns(row);
    if (found) { cols = found; return; }

    const a = row[0];
    const b = row[1];
    if (!(typeof a === 'number' || (typeof a === 'string' && /^\d/.test(a.trim()))) || typeof b !== 'string' || !b.trim()) return;
    if (!cols) return; // haven't seen a header row yet — can't read an answer without knowing the columns

    const label = normalizeLabel(b);
    const bucket = byLabel.get(label);
    const matchedItem = bucket?.find(it => !matchedIds.has(it.id));
    if (matchedItem) {
      matchedIds.add(matchedItem.id);
      applyRowAnswer(row, cols, matchedItem, answers, noComments);
    } else {
      candidateRows.push({ rawLabel: b.trim(), label, row });
    }
  });

  // Fuzzy fallback for anything that didn't match exactly — only accepted
  // above a high threshold, and only against items not already matched.
  const unmatchedItems = allItems.filter(it => !matchedIds.has(it.id));
  candidateRows.forEach(({ label, row }) => {
    if (!unmatchedItems.length) return;
    let best = null;
    let bestScore = 0;
    unmatchedItems.forEach(item => {
      if (matchedIds.has(item.id)) return;
      const score = similarityRatio(label, normalizeLabel(item.label));
      if (score > bestScore) { bestScore = score; best = item; }
    });
    if (best && bestScore >= 0.9) {
      matchedIds.add(best.id);
      applyRowAnswer(row, findHeaderColumnsForRowFallback(cols), best, answers, noComments);
    }
  });

  return {
    answers,
    noComments,
    matchedCount: matchedIds.size,
    totalItems: allItems.length,
    unmatchedItems: allItems.filter(it => !matchedIds.has(it.id)),
  };
}

// cols is stable once found (sheets in this format don't change column
// layout mid-sheet) — this just keeps the fuzzy-match call site readable.
function findHeaderColumnsForRowFallback(cols) {
  return cols;
}

function applyRowAnswer(row, cols, item, answers, noComments) {
  const yesVal = row[cols.yes];
  const noVal = row[cols.no];
  const naVal = row[cols.na];
  if (yesVal != null && yesVal !== '') answers[item.id] = 'YES';
  else if (noVal != null && noVal !== '') answers[item.id] = 'NO';
  else if (naVal != null && naVal !== '') answers[item.id] = 'NA';

  if (answers[item.id] === 'NO' && cols.remarks != null) {
    const remark = row[cols.remarks];
    if (typeof remark === 'string' && remark.trim()) {
      noComments[item.id] = remark.trim();
    }
  }
}

export async function parseMysteryShopperFile(file, template) {
  const { XLSX, workbook } = await readWorkbook(file);
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 1) {
    const result = parseAnswersFromSheet(XLSX, workbook.Sheets[sheetNames[0]], template);
    return { ...result, sheetNames, usedSheet: sheetNames[0], needsSheetChoice: false };
  }
  // Multiple sheets (e.g. a copy of the full multi-brand workbook, or a
  // file with extra reference tabs) — try each and keep whichever one
  // actually matched something, since the real data could be in any tab.
  let best = null;
  for (const name of sheetNames) {
    const result = parseAnswersFromSheet(XLSX, workbook.Sheets[name], template);
    if (!best || result.matchedCount > best.matchedCount) {
      best = { ...result, sheetNames, usedSheet: name };
    }
  }
  return { ...best, needsSheetChoice: best.matchedCount === 0 };
}
