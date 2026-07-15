import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format } from 'date-fns';

export default function ExportButton({ tickets, dateRange, departmentName }) {
  const [exporting, setExporting] = useState(false);

  const exportToCSV = () => {
    setExporting(true);
    
    // Prepare CSV data
    const headers = [
      'Ticket ID',
      'Title',
      'Description',
      'Department',
      'Category',
      'Status',
      'Priority',
      'Assigned To',
      'Submitter',
      'Created Date',
      'Updated Date'
    ];

    const rows = tickets.map(ticket => [
      ticket.id,
      ticket.title,
      ticket.description?.replace(/"/g, '""'),
      ticket.department_name,
      ticket.category_name || '',
      ticket.status,
      ticket.priority,
      ticket.assigned_to || 'Unassigned',
      ticket.submitter_name || ticket.submitter_email,
      format(new Date(ticket.created_date), 'yyyy-MM-dd HH:mm:ss'),
      format(new Date(ticket.updated_date), 'yyyy-MM-dd HH:mm:ss')
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      )
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filename = `tickets_report_${departmentName || 'all'}_${dateRange}days_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => setExporting(false), 500);
  };

  return (
    <Button 
      onClick={exportToCSV}
      disabled={exporting || tickets.length === 0}
      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Export to CSV
    </Button>
  );
}