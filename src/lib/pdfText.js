// jsPDF's built-in fonts (Helvetica etc.) only cover WinAnsi: Latin-1 plus a
// few typographic extras like curly quotes and dashes. Anything else — emoji
// above all, but also ₱, ✓, → — comes out of doc.text() as random
// characters ("Ø=ÞÀ"). These helpers draw those characters as small images
// rendered with the browser's own fonts, so an emoji in a checklist item or
// comment looks the same in the PDF as it did on screen, while everything
// else stays ordinary PDF text. Text with nothing to swap goes straight to
// jsPDF, exactly as before.

// Code points outside Latin-1 that WinAnsi still covers (jsPDF maps these).
const WIN_ANSI_EXTRAS = new Set([
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017D, 0x017E, 0x0192, 0x02C6,
  0x02DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
  0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203A, 0x20AC, 0x2122,
]);

const isPlainText = (text) => {
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint > 0xFF && !WIN_ANSI_EXTRAS.has(codePoint)) return false;
  }
  return true;
};

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

// Grapheme clusters, so an emoji with a skin tone or a joined family stays
// one picture instead of several.
const toGraphemes = (text) => (segmenter
  ? Array.from(segmenter.segment(text), (part) => part.segment)
  : Array.from(text));

// Plain stretches stay text; every other grapheme becomes its own image run.
const toRuns = (text) => {
  const runs = [];
  for (const grapheme of toGraphemes(text)) {
    const last = runs[runs.length - 1];
    if (!isPlainText(grapheme)) runs.push({ text: grapheme, image: true });
    else if (last && !last.image) last.text += grapheme;
    else runs.push({ text: grapheme, image: false });
  }
  return runs;
};

// Glyphs are drawn this big, then scaled down, so they stay sharp when the
// PDF is zoomed or printed.
const GLYPH_PX = 96;
const GLYPH_FONT = `${GLYPH_PX}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif`;

let measureContext = null;
const metricsCache = new Map();
const imageCache = new Map();

// Advance width plus the inked box around the baseline, in canvas pixels.
const glyphMetrics = (grapheme) => {
  let metrics = metricsCache.get(grapheme);
  if (!metrics) {
    if (!measureContext) measureContext = document.createElement('canvas').getContext('2d');
    measureContext.font = GLYPH_FONT;
    const measured = measureContext.measureText(grapheme);
    const box = (value, fallback) => Math.ceil(Number.isFinite(value) ? value : fallback);
    const left = box(measured.actualBoundingBoxLeft, 0);
    const right = box(measured.actualBoundingBoxRight, measured.width);
    const ascent = box(measured.actualBoundingBoxAscent, GLYPH_PX * 0.9);
    const descent = box(measured.actualBoundingBoxDescent, GLYPH_PX * 0.25);
    metrics = { advance: measured.width, left, ascent, inkWidth: left + right, inkHeight: ascent + descent };
    metricsCache.set(grapheme, metrics);
  }
  return metrics;
};

// Color only matters for symbols like ₱ — emoji bring their own colors.
const glyphImage = (grapheme, color) => {
  const key = `${color} ${grapheme}`;
  let image = imageCache.get(key);
  if (!image) {
    const metrics = glyphMetrics(grapheme);
    const canvas = document.createElement('canvas');
    canvas.width = metrics.inkWidth;
    canvas.height = metrics.inkHeight;
    const ctx = canvas.getContext('2d');
    ctx.font = GLYPH_FONT;
    ctx.fillStyle = color;
    ctx.fillText(grapheme, metrics.left, metrics.ascent);
    image = { dataUrl: canvas.toDataURL('image/png'), alias: `pdf-glyph-${imageCache.size}` };
    imageCache.set(key, image);
  }
  return image;
};

// Document units per canvas pixel at the current font size.
const glyphScale = (doc) => doc.getFontSize() / doc.internal.scaleFactor / GLYPH_PX;

// Plain-text width the way jsPDF actually draws it. doc.getTextWidth()
// subtracts kerning that doc.text() never applies, so a long run measures
// short and whatever is drawn after it overlaps its last space.
const textWidth = (doc, text) =>
  (doc.getStringUnitWidth(text, { doKerning: false }) * doc.getFontSize()) / doc.internal.scaleFactor;

const measurePdfText = (doc, text) => {
  const scale = glyphScale(doc);
  return toRuns(text).reduce(
    (width, run) => width + (run.image ? glyphMetrics(run.text).advance * scale : textWidth(doc, run.text)),
    0
  );
};

const wrapLine = (doc, paragraph, maxWidth) => {
  const lines = [];
  let line = '';
  // Each word keeps its surrounding spaces, so lines join back losslessly.
  for (const word of paragraph.match(/\s*\S+\s*/g) || [paragraph]) {
    if (measurePdfText(doc, (line + word).trimEnd()) <= maxWidth) {
      line += word;
      continue;
    }
    if (line) lines.push(line.trimEnd());
    // A single word wider than the whole line breaks between graphemes.
    let rest = word.trimStart();
    while (measurePdfText(doc, rest.trimEnd()) > maxWidth) {
      let piece = '';
      for (const grapheme of toGraphemes(rest)) {
        if (piece && measurePdfText(doc, piece + grapheme) > maxWidth) break;
        piece += grapheme;
      }
      lines.push(piece);
      rest = rest.slice(piece.length).trimStart();
    }
    line = rest;
  }
  lines.push(line.trimEnd());
  return lines;
};

// Drop-in for doc.splitTextToSize().
export function splitPdfText(doc, text, maxWidth) {
  const value = String(text ?? '');
  if (isPlainText(value)) return doc.splitTextToSize(value, maxWidth);
  return value.split(/\r\n|\r|\n/).flatMap((paragraph) => wrapLine(doc, paragraph, maxWidth));
}

// Drop-in for doc.text(text, x, y, { align }) — a string, or an array of
// lines from splitPdfText() drawn one under another the way jsPDF does.
export function drawPdfText(doc, text, x, y, options = {}) {
  const lines = Array.isArray(text)
    ? text.map((line) => String(line ?? ''))
    : String(text ?? '').split(/\r\n|\r|\n/);
  if (lines.every(isPlainText)) {
    doc.text(text, x, y, options);
    return;
  }
  const lineHeight = (doc.getFontSize() * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
  const scale = glyphScale(doc);
  const color = doc.getTextColor();
  lines.forEach((line, index) => {
    const baseline = y + index * lineHeight;
    const width = measurePdfText(doc, line);
    let cursor = options.align === 'center' ? x - width / 2 : options.align === 'right' ? x - width : x;
    for (const run of toRuns(line)) {
      if (!run.image) {
        // Word by word, each at its measured spot: viewers that swap in their
        // own Helvetica (Preview/iOS among them) draw text a hair wider or
        // narrower than jsPDF measures, and over a long run that drift would
        // push the next emoji into the last word.
        for (const piece of run.text.split(/(\s+)/)) {
          if (piece.trim()) doc.text(piece, cursor, baseline);
          cursor += textWidth(doc, piece);
        }
        continue;
      }
      const metrics = glyphMetrics(run.text);
      if (metrics.inkWidth > 0 && metrics.inkHeight > 0) {
        const image = glyphImage(run.text, color);
        doc.addImage(
          image.dataUrl, 'PNG',
          cursor - metrics.left * scale, baseline - metrics.ascent * scale,
          metrics.inkWidth * scale, metrics.inkHeight * scale,
          image.alias
        );
      }
      cursor += metrics.advance * scale;
    }
  });
}
