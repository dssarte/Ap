import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Settings, Loader2, ShieldAlert, Tags, Clock, Zap, BarChart3, GitBranch, ClipboardList, Store, Download, CalendarCheck, Database, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import DepartmentManager from "@/components/admin/DepartmentManager";
import UserManager from "@/components/admin/UserManager";
import CategoryManager from "@/components/admin/CategoryManager";
import SLAManager from "@/components/admin/SLAManager";
import CannedResponseManager from "@/components/admin/CannedResponseManager";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import RulesEngine from "@/components/admin/RulesEngine";
import AuditTemplateManager from "@/components/admin/AuditTemplateManager";
import BrandManager from "@/components/admin/BrandManager";
import AuditAssignmentManager from "@/components/admin/AuditAssignmentManager";
import ChecklistCompletionManager from "@/components/admin/ChecklistCompletionManager";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await base44.functions.invoke('exportDatabaseBackup', {});
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HelpDesk_DB_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadPresentation = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('generatePresentation', {}, { responseType: 'arraybuffer' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'HelpDesk_Management_Presentation.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (user?.user_type !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#1fd655] flex items-center justify-center shadow-lg">
                <Settings className="w-7 h-7 text-white" />
              </div>
              Admin Panel
            </h1>
            <p className="text-slate-600 text-lg">Manage departments, users, and system settings</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              className="gap-2 bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 h-11 px-6 font-semibold"
            >
              {backupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
              {backupLoading ? 'Exporting...' : 'Download DB Backup'}
            </Button>
            <Button
              onClick={handleDownloadPresentation}
              disabled={downloading}
              className="gap-2 bg-slate-900 hover:bg-slate-800 text-white h-11 px-6 font-semibold"
            >
              {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {downloading ? 'Generating...' : 'Download Presentation'}
            </Button>
            <a href="/SqlExport">
              <Button className="gap-2 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 h-11 px-6 font-semibold">
                <FileDown className="w-5 h-5" />
                Export to Supabase (.sql)
              </Button>
            </a>
          </div>
        </div>

        <Tabs defaultValue="departments" className="space-y-8">
          <TabsList className="bg-white shadow-md border-2 border-slate-200 p-1.5 rounded-xl h-auto flex-wrap gap-1">
            <TabsTrigger value="departments" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <Building2 className="w-5 h-5 mr-2" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <Tags className="w-5 h-5 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <Users className="w-5 h-5 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="sla" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <Clock className="w-5 h-5 mr-2" />
              SLA Policies
            </TabsTrigger>
            <TabsTrigger value="canned" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <Zap className="w-5 h-5 mr-2" />
              Canned Responses
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <BarChart3 className="w-5 h-5 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <GitBranch className="w-5 h-5 mr-2" />
              Rules Engine
            </TabsTrigger>
            <TabsTrigger value="audit-templates" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <ClipboardList className="w-5 h-5 mr-2" />
              Audit Templates
            </TabsTrigger>
            <TabsTrigger value="brands" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <Store className="w-5 h-5 mr-2" />
              Brands & Stores
            </TabsTrigger>
            <TabsTrigger value="audit-assignments" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <ClipboardList className="w-5 h-5 mr-2" />
              Audit Assignments
            </TabsTrigger>
            <TabsTrigger value="checklist-completion" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11 transition-all">
              <CalendarCheck className="w-5 h-5 mr-2" />
              Checklist Completion
            </TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <DepartmentManager />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManager />
          </TabsContent>

          <TabsContent value="users">
            <UserManager />
          </TabsContent>

          <TabsContent value="sla">
            <SLAManager />
          </TabsContent>

          <TabsContent value="canned">
            <CannedResponseManager />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="rules">
            <RulesEngine />
          </TabsContent>

          <TabsContent value="audit-templates">
            <AuditTemplateManager />
          </TabsContent>

          <TabsContent value="brands">
            <BrandManager />
          </TabsContent>

          <TabsContent value="audit-assignments">
            <AuditAssignmentManager />
          </TabsContent>

          <TabsContent value="checklist-completion">
            <ChecklistCompletionManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}