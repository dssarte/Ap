// Reusable multi-sheet Excel export using SpreadsheetML 2003 XML (.xls).
// Opens natively in Microsoft Excel, Google Sheets, and LibreOffice Calc.
// No external dependencies required.

function escapeXml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// sheets: [{ name: 'Sheet Name', headers: [..], rows: [[...], [...]] }]
//   - headers: array of column header strings
//   - rows: array of arrays; numeric values become Number cells, everything else String
export function exportSheetsToExcel(workbookName, sheets) {
  const safeSheets = (sheets || []).filter(s => s && s.headers && s.rows);

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
    <Font ss:FontName="Calibri" ss:Size="11"/>
    <Interior/>
    <Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
      <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
      <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
      <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
    </Borders>
  </Style>
  <Style ss:ID="header">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1A2E1A"/>
    <Interior ss:Color="#1FD655" ss:Pattern="Solid"/>
    <Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
      <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
      <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
      <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
    </Borders>
  </Style>
  <Style ss:ID="title">
    <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1"/>
  </Style>
  <Style ss:ID="pass">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#15803D" ss:Bold="1"/>
  </Style>
  <Style ss:ID="fail">
    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#B91C1C" ss:Bold="1"/>
  </Style>
</Styles>
${safeSheets.map(sheet => {
  const colCount = sheet.headers.length;
  return `<Worksheet ss:Name="${escapeXml(sheet.name.slice(0, 31))}">
<Table>
${sheet.headers.map(() => '<Column ss:AutoFitWidth="1" ss:Width="140"/>').join('')}
${sheet.title ? `<Row><Cell ss:StyleID="title" ss:MergeAcross="${Math.max(0, colCount - 1)}"><Data ss:Type="String">${escapeXml(sheet.title)}</Data></Cell></Row>` : ''}
<Row>
${sheet.headers.map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
</Row>
${sheet.rows.map(row => {
  const cells = Array.isArray(row) ? row : (row.cells || []);
  const rowStyleId = row && row.__styleId ? row.__styleId : null;
  return `<Row>
${cells.map(c => {
  const isNum = typeof c === 'number' && isFinite(c);
  const styleAttr = rowStyleId ? ` ss:StyleID="${rowStyleId}"` : '';
  const type = isNum ? 'Number' : 'String';
  return `<Cell${styleAttr}><Data ss:Type="${type}">${isNum ? c : escapeXml(c)}</Data></Cell>`;
}).join('')}
</Row>`;
}).join('\n')}
</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
  <Selected/>
  <FreezePanes/>
  <FrozenNoSplit/>
  <SplitHorizontal>1</SplitHorizontal>
  <TopRowBottom>1</TopRowBottom>
  <ActivePane>2</ActivePane>
</WorksheetOptions>
</Worksheet>`;
}).join('\n')}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  link.download = `${workbookName}_${stamp}.xls`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}