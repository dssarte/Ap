import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";

// Reusable "Export to Excel" button.
// Props:
//   onClick: () => void  — builds the sheets and calls exportSheetsToExcel
//   disabled: boolean
//   label: string (default "Export to Excel")
export default function ExcelExportButton({ onClick, disabled, label = "Export to Excel", className = "" }) {
  const [exporting, setExporting] = useState(false);

  const handleClick = () => {
    setExporting(true);
    try {
      onClick();
    } finally {
      setTimeout(() => setExporting(false), 600);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={exporting || disabled}
      className={`bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md ${className}`}
    >
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
      {label}
    </Button>
  );
}