import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Users, Building2, Tags, Clock, CheckCircle, XCircle,
  AlertCircle, BarChart3, FileText, MessageSquare, Star, ChevronRight,
  Shield, Eye, Plus, Search, Bell, Download, Loader2, ClipboardList
} from "lucide-react";
import AuditManualTab from "@/components/usermanual/AuditManualTab";

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

// ---- Tab content components ----

function UserGuideTab() {
  return (
    <Card className="border-2 border-slate-200 shadow-xl">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/10 to-transparent">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Users className="w-6 h-6 text-[#1fd655]" />
          User Guide — Submitting & Managing Tickets
        </CardTitle>
        <p className="text-slate-600 text-sm mt-1">For regular users who submit support tickets.</p>
      </CardHeader>
      <CardContent className="py-8 space-y-2">
        <InfoBox type="info">
          As a regular user, you can submit support tickets, track their status, and communicate with staff through the Home page.
        </InfoBox>
        <Section icon={Plus} title="Submitting a New Ticket">
          <Step number="1" title='Click "New Ticket"' description='Find the green "New Ticket" button on the Home page and click it.' />
          <Step number="2" title="Fill in the Title" description="Enter a short, clear summary of your issue." />
          <Step number="3" title="Select a Department" description="Choose the department that best matches your request." />
          <Step number="4" title="Select a Category" description="Pick the category that describes the type of issue." />
          <Step number="5" title="Set Priority" description="Choose Low, Medium, High, or Urgent based on the urgency of your request." />
          <Step number="6" title="Write a Description" description="Describe your issue in detail. Include any relevant information to help the staff resolve it faster." />
          <Step number="7" title="Attach Files (Optional)" description="You can upload an attachment or multiple images to support your request." />
          <Step number="8" title='Click "Submit Ticket"' description="Your ticket will be submitted and sent to an approver for review." />
          <InfoBox type="warning">
            Your ticket will go through an approval process before being handled by staff.
          </InfoBox>
        </Section>
        <Section icon={Search} title="Searching & Filtering Tickets">
          <Step number="1" title="Search by keyword" description="Use the search bar to find tickets by title or description." />
          <Step number="2" title="Filter by Status" description="Use the Status dropdown to show only tickets with a specific status (e.g. Open, Resolved)." />
          <Step number="3" title="Filter by Category" description="Use the Category dropdown to narrow down tickets by type." />
        </Section>
        <Section icon={Eye} title="Viewing Ticket Details">
          <Step number="1" title="Click on any ticket card" description="Opens the full ticket detail panel." />
          <Step number="2" title="View status and updates" description="See the current status, priority, assigned staff, and SLA indicators." />
          <Step number="3" title="Read comments" description="View messages from staff in the Discussion section." />
          <Step number="4" title="Add a reply" description="Type a comment and submit it to communicate with the support team." />
        </Section>
        <Section icon={Bell} title="Understanding Ticket Statuses">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className="bg-amber-100 text-amber-700 border-0">Pending Approval</Badge>
            <Badge className="bg-blue-100 text-blue-700 border-0">Open</Badge>
            <Badge className="bg-yellow-100 text-yellow-700 border-0">In Progress</Badge>
            <Badge className="bg-green-100 text-green-700 border-0">Resolved</Badge>
            <Badge className="bg-slate-100 text-slate-600 border-0">Closed</Badge>
          </div>
          <FeatureItem icon={ChevronRight} label="Pending Approval — waiting for an approver to review your request" />
          <FeatureItem icon={ChevronRight} label="Open — approved and queued for a staff member" />
          <FeatureItem icon={ChevronRight} label="In Progress — a staff member is actively working on it" />
          <FeatureItem icon={ChevronRight} label="Resolved — the issue has been resolved" />
          <FeatureItem icon={ChevronRight} label="Closed — the ticket is fully closed" />
        </Section>
        <Section icon={Bell} title="Ticket updates">
          <p className="text-sm text-slate-600 mb-3">An unread number appears directly on a ticket when:</p>
          <FeatureItem icon={ChevronRight} label="Your ticket is approved or rejected" />
          <FeatureItem icon={ChevronRight} label="A staff member is assigned to your ticket" />
          <FeatureItem icon={ChevronRight} label="Your ticket status is updated" />
          <FeatureItem icon={ChevronRight} label="A comment is added to your ticket" />
          <p className="mt-3 text-sm text-slate-600">Open the ticket to read the update and automatically clear its unread number.</p>
        </Section>
      </CardContent>
    </Card>
  );
}

function AdminManualTab() {
  return (
    <Card className="border-2 border-slate-200 shadow-xl">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/10 to-transparent">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Shield className="w-6 h-6 text-[#1fd655]" />
          Admin Panel — Full Manual
        </CardTitle>
        <p className="text-slate-600 text-sm mt-1">Only users with <strong>Admin</strong> role can access this panel.</p>
      </CardHeader>
      <CardContent className="py-8 space-y-2">
        <InfoBox type="info">
          The Admin Panel is accessible via the <strong>Admin</strong> link in the top navigation bar. It contains four main tabs: Departments, Categories, Users, and SLA Policies.
        </InfoBox>
        <Section icon={Building2} title="Departments Tab">
          <p className="text-sm text-slate-600 mb-4">Manage all departments within the organization. Departments are used to route tickets to the correct team.</p>
          <Step number="1" title="View All Departments" description="All existing departments are listed with their name, description, and active/inactive status." />
          <Step number="2" title="Add a New Department" description='Click the "Add Department" button. Fill in the Department Name (required) and an optional Description, then click Save.' />
          <Step number="3" title="Edit a Department" description="Click the pencil icon next to any department. Update the name or description, then save your changes." />
          <Step number="4" title="Toggle Active Status" description="Use the toggle switch to enable or disable a department. Inactive departments will not appear in the ticket submission form." />
          <Step number="5" title="Delete a Department" description="Click the trash icon and confirm the deletion." />
          <InfoBox type="warning">
            Deactivating a department prevents new tickets from being submitted to it, but existing tickets remain unaffected.
          </InfoBox>
        </Section>
        <Section icon={Tags} title="Categories Tab">
          <p className="text-sm text-slate-600 mb-4">Categories help classify tickets for easier filtering and reporting.</p>
          <Step number="1" title="View All Categories" description="A list of all categories with name, description, and status is displayed." />
          <Step number="2" title="Add a New Category" description='Click "Add Category", fill in the name and optional description, then save.' />
          <Step number="3" title="Edit a Category" description="Click the edit icon beside any category to update its details." />
          <Step number="4" title="Toggle Active/Inactive" description="Only active categories appear when submitting a ticket." />
          <Step number="5" title="Delete a Category" description="Use the trash icon with confirmation dialog to remove a category." />
        </Section>
        <Section icon={Users} title="Users Tab">
          <p className="text-sm text-slate-600 mb-4">View and manage all registered users in the system.</p>
          <div className="mb-4">
            <p className="font-semibold text-slate-800 mb-2">User Types Available:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Admin', desc: 'Full system access' },
                { label: 'Department Head', desc: 'Manages department & views dashboard' },
                { label: 'Staff', desc: 'Handles & resolves tickets' },
                { label: 'Approver', desc: 'Reviews and approves ticket requests' },
                { label: 'Regular User', desc: 'Submits support tickets' },
              ].map(u => (
                <div key={u.label} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                  <Badge className="bg-[#1fd655]/20 text-slate-800 border-0 text-xs">{u.label}</Badge>
                  <span className="text-xs text-slate-600">{u.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <Step number="1" title="Search Users" description="Use the search bar to find users by name, email, or department." />
          <Step number="2" title="Edit a User" description="Click the pencil icon. You can update the user's full name, user type, and department. Click Save Changes when done." />
          <Step number="3" title="Delete a User" description="Click the trash icon next to the user. A confirmation dialog will appear — click Delete to permanently remove the account." />
          <InfoBox type="danger">
            Deleting a user is permanent and cannot be undone. The user will lose access to the system immediately.
          </InfoBox>
        </Section>
        <Section icon={Clock} title="SLA Policies Tab">
          <p className="text-sm text-slate-600 mb-4">SLA (Service Level Agreement) policies define response and resolution time targets for tickets based on priority.</p>
          <Step number="1" title="View SLA Policies" description="All SLA policies are listed with their name, priority level, response time, and resolution time." />
          <Step number="2" title="Create an SLA Policy" description="Click Add SLA Policy. Fill in: Name, Priority (Low / Medium / High / Urgent), Response Time (hours), Resolution Time (hours), and optionally an Escalation email and hours." />
          <Step number="3" title="Edit an SLA Policy" description="Click edit to update any field of an existing SLA policy." />
          <Step number="4" title="Toggle Active/Inactive" description="Only active SLA policies are applied to new tickets." />
          <Step number="5" title="Delete an SLA Policy" description="Remove an SLA policy via the trash icon with confirmation." />
          <InfoBox type="info">
            SLA timers start automatically when a ticket is approved. Breaches are flagged with a red indicator on the ticket card.
          </InfoBox>
        </Section>
      </CardContent>
    </Card>
  );
}

function ApprovalQueueTab() {
  return (
    <Card className="border-2 border-slate-200 shadow-xl">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/10 to-transparent">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <CheckCircle className="w-6 h-6 text-[#1fd655]" />
          Approval Queue — User Manual
        </CardTitle>
        <p className="text-slate-600 text-sm mt-1">Only users with <strong>Approver</strong> role can access this page.</p>
      </CardHeader>
      <CardContent className="py-8 space-y-2">
        <InfoBox type="info">
          The Approval Queue is your workspace for reviewing ticket requests submitted by regular users. You can approve, reject, and comment on tickets assigned to you.
        </InfoBox>
        <Section icon={BarChart3} title="Overview & Stats">
          <p className="text-sm text-slate-600 mb-3">At the top of the page, three summary cards show:</p>
          <FeatureItem icon={Clock} label="Pending Approval — tickets awaiting your decision" />
          <FeatureItem icon={CheckCircle} label="Approved — tickets you have approved" />
          <FeatureItem icon={XCircle} label="Rejected — tickets you have rejected" />
        </Section>
        <Section icon={FileText} title="Browsing Tickets">
          <p className="text-sm text-slate-600 mb-3">Tickets are organized in three tabs:</p>
          <Step number="1" title="Pending Tab" description="Lists all tickets waiting for your review. These require action." />
          <Step number="2" title="Approved Tab" description="Shows tickets you have already approved. Read-only." />
          <Step number="3" title="Rejected Tab" description="Shows tickets you have rejected, along with the rejection reasons." />
        </Section>
        <Section icon={Eye} title="Viewing Ticket Details">
          <Step number="1" title="Click on any ticket card" description="A detailed panel will open on the right side of the screen." />
          <Step number="2" title="Review ticket information" description="See the full description, priority, department, category, submitter details, and any attached files." />
          <Step number="3" title="Read existing comments" description="Scroll down in the detail panel to view the discussion history." />
        </Section>
        <Section icon={CheckCircle} title="Approving a Ticket">
          <Step number="1" title='Click "Approve"' description="The green Approve button is visible in the ticket detail panel (only for pending tickets)." />
          <Step number="2" title="Confirm the action" description="A confirmation dialog will appear. Click Yes, Approve to proceed." />
          <Step number="3" title="Ticket is processed" description="The ticket status changes to Open and SLA timers are automatically applied." />
          <InfoBox type="success">
            Once approved, the ticket moves to the staff queue and the submitter is notified.
          </InfoBox>
        </Section>
        <Section icon={XCircle} title="Rejecting a Ticket">
          <Step number="1" title='Click "Reject"' description="The red Reject button is visible in the ticket detail panel (only for pending tickets)." />
          <Step number="2" title="Confirm the action" description="A confirmation dialog will appear. Click Yes, Reject to continue." />
          <Step number="3" title="Provide a reason" description="A text box will appear asking for a rejection reason. This is required." />
          <Step number="4" title='Click "Submit Rejection"' description="The ticket is marked as rejected and a comment is automatically added with your reason." />
          <InfoBox type="danger">
            Rejected tickets are visible to the submitter. Always provide a clear and helpful rejection reason.
          </InfoBox>
        </Section>
        <Section icon={MessageSquare} title="Adding Comments">
          <Step number="1" title="Open a ticket" description="Click on any ticket card to open the details panel." />
          <Step number="2" title="Write your comment" description="Scroll to the comments section and type your message in the text area." />
          <Step number="3" title='Click "Add Comment"' description="Your comment is saved and visible in the discussion thread." />
          <InfoBox type="info">
            You can comment on both pending and resolved tickets. Use comments to request more information from the submitter.
          </InfoBox>
        </Section>
      </CardContent>
    </Card>
  );
}

function DepartmentDashboardTab() {
  return (
    <Card className="border-2 border-slate-200 shadow-xl">
      <CardHeader className="border-b bg-gradient-to-r from-[#1fd655]/10 to-transparent">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <BarChart3 className="w-6 h-6 text-[#1fd655]" />
          Department Dashboard — User Manual
        </CardTitle>
        <p className="text-slate-600 text-sm mt-1">Only users with <strong>Department Head</strong> role can access this page.</p>
      </CardHeader>
      <CardContent className="py-8 space-y-2">
        <InfoBox type="info">
          The Department Dashboard gives you a real-time overview of your department ticket activity, team members, and performance metrics.
        </InfoBox>
        <Section icon={BarChart3} title="Summary Stats (Top Cards)">
          <p className="text-sm text-slate-600 mb-3">Four cards appear at the top of the page:</p>
          <FeatureItem icon={AlertCircle} label="Open Tickets — total tickets currently open or in progress" />
          <FeatureItem icon={CheckCircle} label="Closed Tickets — tickets that are resolved or closed" />
          <FeatureItem icon={Clock} label="Avg Resolution Time — average hours taken to resolve tickets" />
          <FeatureItem icon={Users} label="Team Members — number of users in your department" />
        </Section>
        <Section icon={BarChart3} title="Tickets by Status Chart">
          <p className="text-sm text-slate-600 mb-3">A bar chart visualizes how many tickets exist in each status:</p>
          <FeatureItem icon={ChevronRight} label="Open" />
          <FeatureItem icon={ChevronRight} label="In Progress" />
          <FeatureItem icon={ChevronRight} label="Resolved" />
          <FeatureItem icon={ChevronRight} label="Closed" />
          <p className="text-sm text-slate-600 mt-2">Hover over each bar to see the exact count.</p>
        </Section>
        <Section icon={Users} title="Team Members Panel">
          <p className="text-sm text-slate-600 mb-3">The right panel lists all users assigned to your department.</p>
          <FeatureItem icon={Star} label="Department Head members are labeled with a Head badge" />
          <FeatureItem icon={Users} label="Regular members are labeled with a Member badge" />
          <FeatureItem icon={ChevronRight} label="Each entry shows the member's full name and email" />
          <InfoBox type="info">
            Team member assignments are managed by the Admin. Contact your admin to add or reassign team members.
          </InfoBox>
        </Section>
        <Section icon={FileText} title="Recent Tickets Table">
          <p className="text-sm text-slate-600 mb-3">The bottom section shows the 10 most recent tickets in your department:</p>
          <FeatureItem icon={ChevronRight} label="Title — the ticket subject" />
          <FeatureItem icon={ChevronRight} label="Status — current ticket status (color-coded badge)" />
          <FeatureItem icon={ChevronRight} label="Priority — Low / Medium / High / Urgent" />
          <FeatureItem icon={ChevronRight} label="Assigned To — staff member handling the ticket" />
          <FeatureItem icon={ChevronRight} label="Created — date the ticket was submitted" />
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800 mb-2">Status Badge Colors:</p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-100 text-blue-700 border-0">Open</Badge>
              <Badge className="bg-yellow-100 text-yellow-700 border-0">In Progress</Badge>
              <Badge className="bg-green-100 text-green-700 border-0">Resolved</Badge>
              <Badge className="bg-slate-100 text-slate-600 border-0">Closed</Badge>
              <Badge className="bg-purple-100 text-purple-700 border-0">Pending</Badge>
            </div>
          </div>
        </Section>
        <Section icon={Bell} title="Tips for Department Heads">
          <InfoBox type="success">
            Check the dashboard daily to monitor open tickets and ensure your team is on track.
          </InfoBox>
          <InfoBox type="warning">
            A high number of open tickets may indicate your team needs more support. Escalate to Admin if needed.
          </InfoBox>
          <InfoBox type="info">
            Use the Reports page for more detailed analytics and export options across longer time periods.
          </InfoBox>
        </Section>
      </CardContent>
    </Card>
  );
}

export default function UserManual() {
  const [user, setUser] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingManual, setDownloadingManual] = useState(false);
  const [hasAuditAccess, setHasAuditAccess] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const isQA = user.department_name === 'Quality Assurance' || user.user_type === 'admin';
    if (isQA || user.store_name) {
      setHasAuditAccess(true);
    } else {
      base44.entities.AuditAssignment.filter({ user_email: user.email, is_active: true })
        .then(assignments => setHasAuditAccess(assignments.length > 0))
        .catch(() => {});
    }
  }, [user]);

  const handleDownloadManual = async () => {
    setDownloadingManual(true);
    try {
      const response = await base44.functions.invoke('generateUserManualPDF');
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HelpDesk_User_Manual_Complete.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      alert('Failed to generate manual: ' + e.message);
    }
    setDownloadingManual(false);
  };

  const handleDownloadPresentation = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('generatePresentation');
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HelpDesk_Management_Presentation.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      alert('Failed to generate presentation: ' + e.message);
    }
    setDownloading(false);
  };

  const userType = user?.user_type;
  const isAdmin = userType === 'admin';
  const isApprover = userType === 'approver' || (userType === 'department_head' && user?.is_approver);
  const isDeptHead = userType === 'department_head';
  const isRegularUser = !isAdmin && !isApprover && !isDeptHead;

  const defaultTab = isAdmin ? 'user' : isDeptHead ? 'department' : isApprover ? 'approver' : 'user';

  return (
    <div className="app-page-shell">
      <div className="app-page app-page-narrow">

        <div className="app-page-header">
          <div>
            <p className="app-page-eyebrow">Product guidance</p>
            <div>
              <h1 className="app-page-heading">Help & manual</h1>
              <p className="app-page-description">Role-specific guidance for the support and audit workspace.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {user && (
              <Badge className="bg-[#1fd655]/20 text-slate-800 border-0 text-sm px-3 py-1">
                Logged in as: <span className="font-bold ml-1">{userType || 'user'}</span>
              </Badge>
            )}
            {isAdmin && (
              <Button
                onClick={handleDownloadManual}
                disabled={downloadingManual}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold gap-2 shadow-md"
              >
                {downloadingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloadingManual ? 'Generating...' : 'Download Complete User Manual (PDF)'}
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={handleDownloadPresentation}
                disabled={downloading}
                className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold gap-2 shadow-md"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? 'Generating...' : 'Download Management Presentation (PDF)'}
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="app-tabs-list">
            {(isRegularUser || isAdmin) && (
              <TabsTrigger value="user" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11">
                <Users className="w-4 h-4 mr-2" /> User Guide
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="admin" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11">
                <Shield className="w-4 h-4 mr-2" /> Admin Manual
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="approver" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11">
                <CheckCircle className="w-4 h-4 mr-2" /> Approval Queue
              </TabsTrigger>
            )}
            {isApprover && !isAdmin && (
              <TabsTrigger value="approver" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11">
                <CheckCircle className="w-4 h-4 mr-2" /> Approval Queue
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="department" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11">
                <BarChart3 className="w-4 h-4 mr-2" /> Department Dashboard
              </TabsTrigger>
            )}
            {isDeptHead && (
              <TabsTrigger value="department" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11">
                <BarChart3 className="w-4 h-4 mr-2" /> Department Dashboard
              </TabsTrigger>
            )}
            {hasAuditAccess && (
              <TabsTrigger value="audit" className="data-[state=active]:bg-[#1fd655] data-[state=active]:text-slate-900 data-[state=active]:font-bold rounded-lg px-6 h-11">
                <ClipboardList className="w-4 h-4 mr-2" /> Audit Guide
              </TabsTrigger>
            )}
          </TabsList>

          {(isRegularUser || isAdmin) && (
            <TabsContent value="user"><UserGuideTab /></TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="admin"><AdminManualTab /></TabsContent>
          )}
          {(isApprover || isAdmin) && (
            <TabsContent value="approver"><ApprovalQueueTab /></TabsContent>
          )}
          {(isDeptHead || isAdmin) && (
            <TabsContent value="department"><DepartmentDashboardTab /></TabsContent>
          )}
          {hasAuditAccess && (
            <TabsContent value="audit"><AuditManualTab /></TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
