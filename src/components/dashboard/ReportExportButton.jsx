import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format } from 'date-fns';

export default function ReportExportButton({ tickets, filters, departmentName }) {
  const [exporting, setExporting] = useState(false);

  const exportCSV = () => {
    setExporting(true);

    const headers = [
      'Ticket ID', 'Title', 'Department', 'Category', 'Status', 'Priority',
      'Assigned To', 'Submitter', 'Created Date', 'Resolved Date', 'Resolution Hours',
      'SLA Response Breached', 'SLA Resolution Breached'
    ];

    const rows = tickets.map(t => {
      const resolutionHours = (t.status === 'resolved' || t.status === 'closed')
        ? Math.round((new Date(t.updated_date) - new Date(t.created_date)) / 3600000)
        : '';
      return [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.department_name || '',
        t.category_name || '',
        t.status || '',
        t.priority || '',
        t.assigned_to || 'Unassigned',
        `"${(t.submitter_name || t.submitter_email || '').replace(/"/g, '""')}"`,
        format(new Date(t.created_date), 'yyyy-MM-dd HH:mm'),
        (t.status === 'resolved' || t.status === 'closed') ? format(new Date(t.updated_date), 'yyyy-MM-dd HH:mm') : '',
        resolutionHours,
        t.sla_response_breached ? 'Yes' : 'No',
        t.sla_resolution_breached ? 'Yes' : 'No',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const periodLabel = filters.period === 'custom' ? `${filters.customFrom}_to_${filters.customTo}` : `${filters.dateRange}days`;
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${departmentName || 'all'}_${periodLabel}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTimeout(() => setExporting(false), 500);
  };

  return (
    <Button
      onClick={exportCSV}
      disabled={exporting || tickets.length === 0}
      className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold gap-2 shadow-md"
    >
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Export CSV ({tickets.length})
    </Button>
  );
}