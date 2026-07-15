import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, ShieldAlert, ArrowLeft } from "lucide-react";
import { Link } from 'react-router-dom';

export default function SqlExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowSummary, setRowSummary] = useState(null);

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setRowSummary(null);
    try {
      const response = await base44.functions.invoke('exportDatabaseSql', {}, { responseType: 'text' });
      const sql = typeof response.data === 'string' ? response.data : new TextDecoder().decode(response.data);
      // Quick row-count summary from the emitted "-- table: N row(s)" comments
      const counts = {};
      const re = /-- ([a-z_]+): (\d+) row\(s\)/g;
      let m;
      while ((m = re.exec(sql)) !== null) counts[m[1]] = parseInt(m[2], 10);
      setRowSummary(counts);

      const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `helpdesk_supabase_${new Date().toISOString().slice(0, 10)}.sql`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page-shell">
      <div className="app-page app-page-narrow">
        <Link to="/Admin">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1 text-slate-500">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Button>
        </Link>

        <div className="app-page-header">
          <div>
            <p className="app-page-eyebrow">Data portability</p>
            <h1 className="app-page-heading">Export to Supabase</h1>
            <p className="app-page-description">Download all app data as a ready-to-import PostgreSQL <code className="font-semibold text-emerald-700">.sql</code> file.</p>
          </div>
        </div>

        <Card className="border-2 border-slate-200 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-lg">What you get</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <FileDown className="w-5 h-5 text-[#1fd655] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">CREATE TABLE + INSERT statements</p>
                <p className="text-slate-500">Schema with foreign-key constraints, then all rows. Wrapped in a single transaction.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileDown className="w-5 h-5 text-[#1fd655] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">UUID primary keys preserved</p>
                <p className="text-slate-500">Existing Base44 record IDs are reused so cross-table relationships stay intact.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileDown className="w-5 h-5 text-[#1fd655] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">ISO 8601 timestamps &amp; JSONB</p>
                <p className="text-slate-500">Dates cast to <code>timestamptz</code>; nested objects/arrays cast to <code>jsonb</code>; all text fields are SQL-escaped.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200 shadow-sm">
          <CardContent className="p-6 flex flex-col items-start gap-4">
            <Button
              onClick={handleExport}
              disabled={loading}
              className="gap-2 bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 h-12 px-8 text-base font-semibold w-full sm:w-auto"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
              {loading ? 'Generating SQL…' : 'Download .sql Export'}
            </Button>

            {error && (
              <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm w-full">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {rowSummary && (
              <div className="w-full">
                <p className="text-sm font-semibold text-slate-700 mb-2">Exported rows per table:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(rowSummary).map(([table, n]) => (
                    <span key={table} className="text-xs bg-slate-100 text-slate-700 rounded-md px-2.5 py-1 font-medium">
                      {table}: <span className="font-bold text-slate-900">{n}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Tip: run <code>psql -f file.sql</code> or paste it into Supabase's SQL Editor. The script drops and recreates tables with FK constraints, so import order is handled automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
