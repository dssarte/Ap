import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, ListChecks, Camera, PenTool, CheckCircle, Eye, FileText, ChevronRight
} from "lucide-react";

const Section = ({ icon: Icon, title, children }) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-[#1fd655]/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#1fd655]" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
    </div>
    <div className="pl-12">{children}</div>
  </div>
);

const Step = ({ number, title, description }) => (
  <div className="flex gap-4 mb-4">
    <div className="w-8 h-8 rounded-full bg-[#1fd655] text-slate-900 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
      {number}
    </div>
    <div>
      <p className="font-semibold text-slate-800">{title}</p>
      {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
    </div>
  </div>
);

const InfoBox = ({ type, children }) => {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    success: "bg-green-50 border-green-200 text-green-800",
    danger: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm mb-4 ${styles[type || 'info']}`}>
      {children}
    </div>
  );
};

const FeatureItem = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-2 py-1.5 text-sm text-slate-700">
    <Icon className="w-4 h-4 text-[#1fd655] shrink-0" />
    {label}
  </div>
);

export default function AuditManualTab() {
  return (
    <Card className="border-2 border-slate-200 shadow-xl">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/10 to-transparent">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <ClipboardList className="w-6 h-6 text-[#1fd655]" />
          Audit — User Manual
        </CardTitle>
        <p className="text-slate-600 text-sm mt-1">Only visible to users with audit access (Quality Assurance, store users, or assigned auditors).</p>
      </CardHeader>
      <CardContent className="py-8 space-y-2">
        <InfoBox type="info">
          The Audit page lets you fill out store checklist forms, upload supporting photos, sign off, and review past submissions.
        </InfoBox>
        <Section icon={ListChecks} title="Starting an Audit">
          <Step number="1" title="Open the Audit page" description='Click "Audit" in the top navigation bar.' />
          <Step number="2" title="Choose a checklist" description="Click any available checklist card to start filling it out." />
          <Step number="3" title="Confirm Brand / Store" description="If your account is tied to a specific store, it's shown automatically. Otherwise, select the Brand and Store first." />
        </Section>
        <Section icon={CheckCircle} title="Answering Checklist Items">
          <Step number="1" title="Answer each item" description="Tap YES, NO, or N/A for every checklist item." />
          <Step number="2" title="Give a reason for NO" description='If you select NO, a "Reason for NO" text box appears and must be filled in before submitting.' />
          <Step number="3" title="Add photos when required" description='Items marked as requiring a photo show an "+ Add Photo" button — a photo is required only when the answer is YES or NO.' />
          <InfoBox type="warning">
            You can't submit the audit until every required reason and photo has been provided.
          </InfoBox>
        </Section>
        <Section icon={Camera} title="Additional Fields">
          <FeatureItem icon={ChevronRight} label="Others — extra notes about the visit" />
          <FeatureItem icon={ChevronRight} label="Concerns and Recommendations — issues found and suggested actions" />
          <FeatureItem icon={ChevronRight} label="Deviations — upload photos of any deviations found" />
          <FeatureItem icon={ChevronRight} label="Updates — notes and attachment photos on follow-up actions" />
        </Section>
        <Section icon={PenTool} title="Signatures">
          <Step number="1" title="Sign in the signature pads" description="Both Signature 1 and Signature 2 must be signed on-screen." />
          <Step number="2" title="Enter name and position" description="Both signature name and position fields are required for each signature." />
        </Section>
        <Section icon={CheckCircle} title="Submitting the Audit">
          <Step number="1" title='Click "Submit Audit"' description="Your score is calculated automatically from the YES/NO answers and the submission is saved." />
          <Step number="2" title="Editing a submission" description="Admins can edit or delete a submission afterward from the Audit History." />
        </Section>
        <Section icon={Eye} title="Audit History">
          <Step number="1" title='Click "History"' description="Opens your past audit submissions." />
          <Step number="2" title="Select a date range" description="Pick a From and To date to view submissions within that period." />
          <Step number="3" title="Open a submission" description="Click any submission to view its full details, including answers, photos, and signatures." />
        </Section>
        <Section icon={FileText} title="Exporting to PDF">
          <Step number="1" title="Open a submission" description="From the Audit History, click a submission to view its details." />
          <Step number="2" title='Click "Export PDF"' description="Downloads a formatted PDF report of the audit, including scores, photos, and signatures." />
        </Section>
        <Section icon={ClipboardList} title="Score Colors">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-green-100 text-green-700 border-0">80% and above — Good</Badge>
            <Badge className="bg-yellow-100 text-yellow-700 border-0">50%–79% — Needs Improvement</Badge>
            <Badge className="bg-red-100 text-red-700 border-0">Below 50% — Poor</Badge>
          </div>
        </Section>
      </CardContent>
    </Card>
  );
}