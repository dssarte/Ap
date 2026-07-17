import{m as S,r as f,j as m,B as x,L as g}from"./index-DW6T9k8_.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]],E=S("FileSpreadsheet",B);function w({onClick:o,disabled:a,label:d="Export to Excel",className:c=""}){const[i,l]=f.useState(!1),e=()=>{l(!0);try{o()}finally{setTimeout(()=>l(!1),600)}};return m.jsxs(x,{onClick:e,disabled:i||a,className:`bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md ${c}`,children:[i?m.jsx(g,{className:"w-4 h-4 animate-spin"}):m.jsx(E,{className:"w-4 h-4"}),d]})}function r(o){return o==null?"":String(o).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function F(o,a){const c=`<?xml version="1.0"?>
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
${(a||[]).filter(s=>s&&s.headers&&s.rows).map(s=>{const u=s.headers.length;return`<Worksheet ss:Name="${r(s.name.slice(0,31))}">
<Table>
${s.headers.map(()=>'<Column ss:AutoFitWidth="1" ss:Width="140"/>').join("")}
${s.title?`<Row><Cell ss:StyleID="title" ss:MergeAcross="${Math.max(0,u-1)}"><Data ss:Type="String">${r(s.title)}</Data></Cell></Row>`:""}
<Row>
${s.headers.map(t=>`<Cell ss:StyleID="header"><Data ss:Type="String">${r(t)}</Data></Cell>`).join("")}
</Row>
${s.rows.map(t=>{const y=Array.isArray(t)?t:t.cells||[],C=t&&t.__styleId?t.__styleId:null;return`<Row>
${y.map(n=>{const p=typeof n=="number"&&isFinite(n);return`<Cell${C?` ss:StyleID="${C}"`:""}><Data ss:Type="${p?"Number":"String"}">${p?n:r(n)}</Data></Cell>`}).join("")}
</Row>`}).join(`
`)}
</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
  <Selected/>
  <FreezePanes/>
  <FrozenNoSplit/>
  <SplitHorizontal>1</SplitHorizontal>
  <TopRowBottom>1</TopRowBottom>
  <ActivePane>2</ActivePane>
</WorksheetOptions>
</Worksheet>`}).join(`
`)}
</Workbook>`,i=new Blob([c],{type:"application/vnd.ms-excel;charset=utf-8"}),l=URL.createObjectURL(i),e=document.createElement("a");e.href=l;const h=new Date().toISOString().slice(0,10);e.download=`${o}_${h}.xls`,e.style.visibility="hidden",document.body.appendChild(e),e.click(),document.body.removeChild(e),setTimeout(()=>URL.revokeObjectURL(l),1e3)}export{w as E,F as e};
