// Multi-sheet Excel export as a real .xlsx workbook — unlike exportExcel.js
// (SpreadsheetML 2003), this format can carry native Excel charts, drawn
// from the workbook's own cells so they stay editable in Excel. No external
// dependencies: the package is written as an uncompressed zip.
//
// sheets: [{ name, title?, headers, rows, columnWidths?, freezeColumns?, charts? }]
//   - rows: arrays of cells; numbers become Number cells, everything else
//     text, and null/'' an empty cell. A cell can also be { value, styleId }
//     and a row { cells, __styleId } — the same shapes exportExcel.js takes.
//   - columnWidths: per-column widths in points (default 140)
//   - freezeColumns: how many leading columns stay put when scrolling right
//   - fitToWidth: print the sheet scaled to one page wide
//   - charts: see buildChart() below
// Style ids: header, title, pass, fail, cellDone, cellPartial, cellNone,
// cellOpen, cellNotDue.

const STYLE_IDS = { header: 1, title: 2, pass: 3, fail: 4, cellDone: 5, cellPartial: 6, cellNone: 7, cellOpen: 8, cellNotDue: 9 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="9">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1A2E1A"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="13"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF15803D"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFB91C1C"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="11"/><color rgb="FF0B0B0B"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="11"/><color rgb="FF94A3B8"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1FD655"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0CA30C"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFAB219"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD03B3B"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFCDE2FB"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFCCCCCC"/></left><right style="thin"><color rgb="FFCCCCCC"/></right><top style="thin"><color rgb="FFCCCCCC"/></top><bottom style="thin"><color rgb="FFCCCCCC"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="5" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="7" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const NS = {
  main: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  rel: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  pkgRel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  chart: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  drawing: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  sheetDrawing: 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
};
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// XML 1.0 can't hold most control characters, even escaped.
const escapeXml = (value) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// 0 → A, 25 → Z, 26 → AA
function columnName(index) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const unwrapCell = (cell) => (cell && typeof cell === 'object' && 'value' in cell ? cell : { value: cell });
const rowCells = (row) => (Array.isArray(row) ? row : row?.cells || []);
// Sheet names: at most 31 characters, none of : \ / ? * [ ]
const safeSheetName = (name) => String(name).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
// Data starts under the title row (if any) and the header row.
const firstDataRow = (sheet) => (sheet.title ? 2 : 1);

function cellXml(ref, cell, rowStyleId) {
  const { value, styleId } = unwrapCell(cell);
  const style = STYLE_IDS[styleId || rowStyleId];
  const s = style ? ` s="${style}"` : '';
  if (isNumber(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  if (value == null || value === '') return style ? `<c r="${ref}"${s}/>` : '';
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function worksheetXml(sheet, index, hasDrawing) {
  const rows = [];
  let r = 0;
  if (sheet.title) {
    r += 1;
    rows.push(`<row r="${r}">${cellXml(`A${r}`, { value: sheet.title, styleId: 'title' })}</row>`);
  }
  if (sheet.headers.length) {
    r += 1;
    rows.push(`<row r="${r}">${sheet.headers.map((h, c) => cellXml(`${columnName(c)}${r}`, { value: h, styleId: 'header' })).join('')}</row>`);
  }
  sheet.rows.forEach(row => {
    r += 1;
    const rowStyleId = row && !Array.isArray(row) ? row.__styleId : null;
    rows.push(`<row r="${r}">${rowCells(row).map((cell, c) => cellXml(`${columnName(c)}${r}`, cell, rowStyleId)).join('')}</row>`);
  });

  const frozenRows = sheet.headers.length ? (sheet.title ? 2 : 1) : 0;
  const frozenCols = sheet.freezeColumns || 0;
  let pane = '';
  if (frozenRows || frozenCols) {
    const split = `${frozenCols ? ` xSplit="${frozenCols}"` : ''}${frozenRows ? ` ySplit="${frozenRows}"` : ''}`;
    const activePane = frozenCols && frozenRows ? 'bottomRight' : frozenRows ? 'bottomLeft' : 'topRight';
    pane = `<pane${split} topLeftCell="${columnName(frozenCols)}${frozenRows + 1}" activePane="${activePane}" state="frozen"/>`;
  }
  const columnCount = sheet.headers.length;
  const cols = columnCount
    ? `<cols>${sheet.headers.map((_, c) => `<col min="${c + 1}" max="${c + 1}" width="${Math.round(((sheet.columnWidths?.[c] || 140) / 5.6) * 10) / 10}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const merge = sheet.title && columnCount > 1 ? `<mergeCells count="1"><mergeCell ref="A1:${columnName(columnCount - 1)}1"/></mergeCells>` : '';

  return `${XML_HEAD}<worksheet xmlns="${NS.main}" xmlns:r="${NS.rel}">`
    + (sheet.fitToWidth ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '')
    + `<sheetViews><sheetView workbookViewId="0"${index === 0 ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>`
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + cols
    + `<sheetData>${rows.join('')}</sheetData>`
    + merge
    + '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
    + (sheet.fitToWidth ? '<pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0"/>' : '')
    + (hasDrawing ? '<drawing r:id="rId1"/>' : '')
    + '</worksheet>';
}

// ---- Charts -----------------------------------------------------------------
//
// chart: {
//   type: 'line' | 'bar' (bars run horizontally, first row at the top),
//   title,
//   anchor: { col, row, width, height }  — where it sits, in cells
//   categories: { sheet, col }            — labels: that column's data rows
//   series: [{ sheet, col, name, color, pointColors?, lineWidth? }]
//   valueAxis: { min, max, majorUnit, format }
//   dataLabels?: number format for a value label on each bar
// }
// Colors are RRGGBB hex. Each series reads its column's data rows; empty
// cells are gaps.

const textProps = (size, color, bold = false) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
const solidLine = (color, width) => `<a:ln w="${width}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln>`;

function rangeOf(sheetsByName, { sheet, col }) {
  const source = sheetsByName.get(safeSheetName(sheet));
  if (!source) throw new Error(`Chart data sheet "${sheet}" isn't in the workbook.`);
  const top = firstDataRow(source) + 1;
  const bottom = top + Math.max(source.rows.length, 1) - 1;
  const column = columnName(col);
  const values = source.rows.map(row => unwrapCell(rowCells(row)[col]).value);
  return { ref: `'${safeSheetName(sheet).replace(/'/g, "''")}'!$${column}$${top}:$${column}$${bottom}`, values };
}

function buildChart(chart, sheetsByName) {
  const categories = rangeOf(sheetsByName, chart.categories);
  const catCache = `<c:strCache><c:ptCount val="${categories.values.length}"/>${categories.values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
  const isBar = chart.type === 'bar';

  const series = chart.series.map((s, i) => {
    const range = rangeOf(sheetsByName, s);
    const numCache = `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${range.values.length}"/>${range.values
      .map((v, p) => (isNumber(v) ? `<c:pt idx="${p}"><c:v>${v}</c:v></c:pt>` : '')).join('')}</c:numCache>`;
    const head = `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${escapeXml(s.name)}</c:v></c:tx>`;
    const data = `<c:cat><c:strRef><c:f>${escapeXml(categories.ref)}</c:f>${catCache}</c:strRef></c:cat>`
      + `<c:val><c:numRef><c:f>${escapeXml(range.ref)}</c:f>${numCache}</c:numRef></c:val>`;
    if (isBar) {
      const points = (s.pointColors || []).map((color, p) => (color
        ? `<c:dPt><c:idx val="${p}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:dPt>`
        : '')).join('');
      const labels = chart.dataLabels
        ? `<c:dLbls><c:numFmt formatCode="${escapeXml(chart.dataLabels)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${textProps(800, '475569')}<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
        : '';
      return `<c:ser>${head}<c:spPr><a:solidFill><a:srgbClr val="${s.color || '2A78D6'}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${points}${labels}${data}</c:ser>`;
    }
    const markers = categories.values.length <= 14
      ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${solidLine('FFFFFF', 9525)}</c:spPr></c:marker>`
      : '<c:marker><c:symbol val="none"/></c:marker>';
    return `<c:ser>${head}<c:spPr><a:ln w="${s.lineWidth || 22225}" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln></c:spPr>${markers}${data}<c:smooth val="0"/></c:ser>`;
  }).join('');

  const axis = chart.valueAxis || {};
  const catAxId = 50010, valAxId = 50020;
  const plot = isBar
    ? `<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="50"/><c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:barChart>`
    : `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:lineChart>`;
  // Bars list their categories top to bottom (reversed), with the value
  // axis kept along the bottom, and label every bar. A line's day labels
  // are thinned to about ten so they don't crowd into each other.
  const labelSkip = isBar ? 1 : Math.max(1, Math.ceil(categories.values.length / 10));
  const catAx = `<c:catAx><c:axId val="${catAxId}"/><c:scaling><c:orientation val="${isBar ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/>`
    + `<c:axPos val="${isBar ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>`
    + `<c:spPr>${solidLine('CBD5E1', 9525)}</c:spPr>${textProps(800, '475569')}`
    + `<c:crossAx val="${valAxId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:tickLblSkip val="${labelSkip}"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const scaling = `<c:scaling><c:orientation val="minMax"/>${axis.max != null ? `<c:max val="${axis.max}"/>` : ''}${axis.min != null ? `<c:min val="${axis.min}"/>` : ''}</c:scaling>`;
  const valAx = `<c:valAx><c:axId val="${valAxId}"/>${scaling}<c:delete val="0"/><c:axPos val="${isBar ? 'b' : 'l'}"/>`
    + `<c:majorGridlines><c:spPr>${solidLine('E2E8F0', 6350)}</c:spPr></c:majorGridlines>`
    + `<c:numFmt formatCode="${escapeXml(axis.format || 'General')}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>`
    + `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${textProps(800, '475569')}`
    + `<c:crossAx val="${catAxId}"/><c:crosses val="${isBar ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/>${axis.majorUnit ? `<c:majorUnit val="${axis.majorUnit}"/>` : ''}</c:valAx>`;
  const legend = chart.series.length > 1 ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${textProps(900, '475569')}</c:legend>` : '';
  const title = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1200" b="1"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:rPr><a:t>${escapeXml(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;

  return `${XML_HEAD}<c:chartSpace xmlns:c="${NS.chart}" xmlns:a="${NS.drawing}" xmlns:r="${NS.rel}"><c:roundedCorners val="0"/>`
    + `<c:chart>${title}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}${catAx}${valAx}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>`
    + `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>${solidLine('E2E8F0', 9525)}</c:spPr>`
    + '</c:chartSpace>';
}

function drawingXml(charts, firstChartNumber) {
  const anchors = charts.map((chart, i) => {
    const { col, row, width, height } = chart.anchor;
    return '<xdr:twoCellAnchor editAs="oneCell">'
      + `<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
      + `<xdr:to><xdr:col>${col + width}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + height}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
      + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${firstChartNumber + i}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
      + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
      + `<a:graphic><a:graphicData uri="${NS.chart}"><c:chart xmlns:c="${NS.chart}" r:id="rId${i + 1}"/></a:graphicData></a:graphic>`
      + '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
  }).join('');
  return `${XML_HEAD}<xdr:wsDr xmlns:xdr="${NS.sheetDrawing}" xmlns:a="${NS.drawing}" xmlns:r="${NS.rel}">${anchors}</xdr:wsDr>`;
}

const relationshipsXml = (rels) => `${XML_HEAD}<Relationships xmlns="${NS.pkgRel}">${rels
  .map(({ id, type, target }) => `<Relationship Id="${id}" Type="${NS.rel}/${type}" Target="${target}"/>`).join('')}</Relationships>`;

// ---- Zip (stored, uncompressed) -------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const directory = [];
  let offset = 0;
  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    directory.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ---- Workbook ---------------------------------------------------------------

export function buildXlsxBlob(sheets) {
  const safeSheets = (sheets || []).filter(s => s && s.headers && s.rows)
    .map(s => ({ ...s, name: safeSheetName(s.name) }));
  const sheetsByName = new Map(safeSheets.map(s => [s.name, s]));
  const files = [];
  const contentTypes = [];
  let chartNumber = 0;
  let drawingNumber = 0;

  safeSheets.forEach((sheet, i) => {
    const charts = sheet.charts || [];
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, content: worksheetXml(sheet, i, charts.length > 0) });
    contentTypes.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    if (!charts.length) return;

    drawingNumber += 1;
    files.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, content: relationshipsXml([{ id: 'rId1', type: 'drawing', target: `../drawings/drawing${drawingNumber}.xml` }]) });
    files.push({ name: `xl/drawings/drawing${drawingNumber}.xml`, content: drawingXml(charts, chartNumber + 1) });
    contentTypes.push(`<Override PartName="/xl/drawings/drawing${drawingNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
    const chartRels = charts.map((chart, c) => {
      chartNumber += 1;
      files.push({ name: `xl/charts/chart${chartNumber}.xml`, content: buildChart(chart, sheetsByName) });
      contentTypes.push(`<Override PartName="/xl/charts/chart${chartNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      return { id: `rId${c + 1}`, type: 'chart', target: `../charts/chart${chartNumber}.xml` };
    });
    files.push({ name: `xl/drawings/_rels/drawing${drawingNumber}.xml.rels`, content: relationshipsXml(chartRels) });
  });

  files.push({
    name: 'xl/workbook.xml',
    content: `${XML_HEAD}<workbook xmlns="${NS.main}" xmlns:r="${NS.rel}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${safeSheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  });
  files.push({
    name: 'xl/_rels/workbook.xml.rels',
    content: relationshipsXml([
      ...safeSheets.map((_, i) => ({ id: `rId${i + 1}`, type: 'worksheet', target: `worksheets/sheet${i + 1}.xml` })),
      { id: `rId${safeSheets.length + 1}`, type: 'styles', target: 'styles.xml' },
    ]),
  });
  files.push({ name: 'xl/styles.xml', content: STYLES_XML });
  files.push({ name: '_rels/.rels', content: relationshipsXml([{ id: 'rId1', type: 'officeDocument', target: 'xl/workbook.xml' }]) });
  files.unshift({
    name: '[Content_Types].xml',
    content: `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + `${contentTypes.join('')}</Types>`,
  });
  return zipFiles(files);
}

export function exportSheetsToXlsx(workbookName, sheets) {
  const blob = buildXlsxBlob(sheets);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${workbookName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
