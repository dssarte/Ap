import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.user_type !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297;
    const H = 210;

    const GREEN = [31, 214, 85];
    const DARK = [15, 23, 42];
    const SLATE = [71, 85, 105];
    const LIGHT = [248, 250, 252];
    const WHITE = [255, 255, 255];

    // ─── helpers ────────────────────────────────────────────────────────────────

    function newSlide(bgColor) {
      doc.addPage();
      doc.setFillColor(...(bgColor || LIGHT));
      doc.rect(0, 0, W, H, 'F');
    }

    function greenBar(y, h) {
      doc.setFillColor(...GREEN);
      doc.rect(0, y, W, h, 'F');
    }

    function sideBar(w) {
      doc.setFillColor(...GREEN);
      doc.rect(0, 0, w, H, 'F');
    }

    function text(str, x, y, opts) {
      const o = opts || {};
      doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
      doc.setFontSize(o.size || 11);
      doc.setTextColor(...(o.color || DARK));
      doc.text(String(str), x, y, { align: o.align || 'left', maxWidth: o.maxWidth });
    }

    function badge(label, x, y, color) {
      const c = color || GREEN;
      doc.setFillColor(...c);
      doc.roundedRect(x, y - 4.5, doc.getTextWidth(label) + 6, 7, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(label, x + 3, y);
    }

    function bullet(str, x, y, maxWidth) {
      doc.setFillColor(...GREEN);
      doc.circle(x + 1.5, y - 1.5, 1.2, 'F');
      text(str, x + 5, y, { size: 10, color: SLATE, maxWidth: maxWidth || 100 });
    }

    function stepBox(num, title, desc, x, y, w) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, w, 22, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.circle(x + 8, y + 7, 5, 'F');
      text(String(num), x + 8, y + 9.5, { size: 9, bold: true, color: DARK, align: 'center' });
      text(title, x + 16, y + 8, { size: 9, bold: true, color: DARK, maxWidth: w - 20 });
      if (desc) text(desc, x + 16, y + 14, { size: 7.5, color: SLATE, maxWidth: w - 20 });
    }

    function infoBox(label, x, y, w, h, color) {
      const c = color || [219, 234, 254];
      doc.setFillColor(...c);
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      text(label, x + 4, y + 6, { size: 8.5, color: [30, 58, 138], maxWidth: w - 8 });
    }

    function headerBar(title, sub) {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, H, 'F');
      greenBar(0, 32);
      text(title, 14, 20, { size: 18, bold: true, color: WHITE });
      if (sub) text(sub, 14, 28, { size: 9, color: [220, 252, 231] });
      doc.setFillColor(...GREEN);
      doc.rect(0, H - 10, W, 10, 'F');
      text('HelpDesk System — Figaro Coffee Group', W / 2, H - 4, { size: 8, color: WHITE, align: 'center' });
    }

    function logoArea(x, y) {
      doc.setFillColor(...GREEN);
      doc.roundedRect(x, y, 28, 28, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text('HD', x + 14, y + 16, { align: 'center' });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 1 — COVER
    // ════════════════════════════════════════════════════════════════════════════
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, H, 'F');

    doc.setFillColor(...GREEN);
    doc.rect(0, 0, 10, H, 'F');
    doc.rect(0, H - 10, W, 10, 'F');

    logoArea(20, 35);

    text('HelpDesk System', 58, 55, { size: 32, bold: true, color: WHITE });
    text('User Manual & Management Presentation', 58, 66, { size: 14, color: GREEN });
    text('Figaro Coffee Group', 58, 76, { size: 11, color: [148, 163, 184] });

    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.line(58, 81, 240, 81);

    text('Presented to: Management Team', 58, 90, { size: 10, color: [203, 213, 225] });
    text('Prepared by: IT / Admin Team', 58, 98, { size: 10, color: [203, 213, 225] });
    text(`Date: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`, 58, 106, { size: 10, color: [203, 213, 225] });

    text('CONFIDENTIAL — ADMIN USE ONLY', W / 2, H - 4, { size: 8, color: GREEN, align: 'center' });

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 2 — AGENDA
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Presentation Agenda', 'What we will cover today');

    const agenda = [
      ['01', 'System Overview', 'Purpose, goals, and architecture of the HelpDesk'],
      ['02', 'User Roles & Access', 'Regular User, Approver, Department Head, Admin'],
      ['03', 'User Guide', 'How to submit, track, and manage support tickets'],
      ['04', 'Approval Queue', 'How ticket approvals are reviewed and actioned'],
      ['05', 'Department Dashboard', 'Monitoring team performance and ticket metrics'],
      ['06', 'Admin Panel', 'Managing departments, users, categories, and SLA policies'],
      ['07', 'Notification System', 'Real-time alerts and notification types'],
      ['08', 'SLA & Escalation', 'Time-based service targets and breach handling'],
      ['09', 'Audit System', 'Store audits, checklists, scoring, and rankings'],
    ];

    agenda.forEach((a, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i % 4;
      const x = 14 + col * 140;
      const y = 42 + row * 38;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, 130, 30, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(x, y, 18, 30, 2, 2, 'F');
      text(a[0], x + 9, y + 17, { size: 12, bold: true, color: WHITE, align: 'center' });
      text(a[1], x + 23, y + 10, { size: 10, bold: true, color: DARK });
      text(a[2], x + 23, y + 19, { size: 8, color: SLATE, maxWidth: 100 });
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 3 — SYSTEM OVERVIEW
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('System Overview', 'HelpDesk — Purpose & Architecture');

    text('What is the HelpDesk System?', 14, 45, { size: 14, bold: true, color: DARK });
    text(
      'A centralized internal ticketing platform built for Figaro Coffee Group to streamline IT and operational support requests. It provides structured workflows with approval gates, SLA tracking, and real-time notifications.',
      14, 55, { size: 10, color: SLATE, maxWidth: 180 }
    );

    const goals = [
      'Centralize all internal support requests in one place',
      'Ensure requests are reviewed and approved before processing',
      'Track resolution times with SLA policies per priority',
      'Give department heads visibility into team performance',
      'Provide complete audit trail for all ticket interactions',
    ];
    text('Key Goals:', 14, 75, { size: 11, bold: true, color: DARK });
    goals.forEach((g, i) => bullet(g, 14, 84 + i * 9, 175));

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(200, 42, 85, 130, 3, 3, 'F');
    text('Tech Stack', 242, 52, { size: 11, bold: true, color: DARK, align: 'center' });
    const stack = ['React + Tailwind CSS', 'Base44 Platform', 'Real-time DB', 'SLA Automation', 'Email Notifications', 'Role-based Access', 'File Uploads', 'PDF Reports'];
    stack.forEach((s, i) => bullet(s, 205, 62 + i * 13, 75));

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 4 — USER ROLES
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('User Roles & Access Control', 'Who can do what in the system');

    const roles = [
      { title: 'Regular User', color: [219, 234, 254], tc: [30, 58, 138], items: ['Submit support tickets', 'Track ticket status', 'Add comments/replies', 'Receive notifications', 'Upload attachments'] },
      { title: 'Approver', color: [254, 249, 195], tc: [133, 77, 14], items: ['Review pending tickets', 'Approve or reject requests', 'Add rejection reasons', 'Comment on tickets', 'View assigned queue'] },
      { title: 'Dept. Head', color: [220, 252, 231], tc: [20, 83, 45], items: ['View department dashboard', 'Monitor team tickets', 'See performance metrics', 'View resolution stats', 'Access Reports page'] },
      { title: 'Admin', color: [255, 237, 213], tc: [154, 52, 18], items: ['Full system access', 'Manage users & roles', 'Configure departments', 'Set SLA policies', 'View all reports'] },
    ];

    roles.forEach((r, i) => {
      const x = 14 + i * 70;
      doc.setFillColor(...r.color);
      doc.roundedRect(x, 38, 64, 130, 3, 3, 'F');
      doc.setFillColor(...r.tc);
      doc.roundedRect(x, 38, 64, 16, 3, 3, 'F');
      text(r.title, x + 32, 48, { size: 10, bold: true, color: WHITE, align: 'center' });
      r.items.forEach((item, j) => {
        bullet(item, x + 4, 62 + j * 13, 56);
      });
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 5 — USER GUIDE: SUBMITTING A TICKET
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('User Guide — Submitting a Ticket', 'Step-by-step process for regular users');

    const steps = [
      ['1', 'Click "New Ticket"', 'Green button on Home page top right'],
      ['2', 'Enter Title', 'Short, clear summary of the issue'],
      ['3', 'Select Department', 'Choose the team handling this request'],
      ['4', 'Select Category', 'Type of issue (IT, HR, Maintenance, etc.)'],
      ['5', 'Set Priority', 'Low / Medium / High / Urgent'],
      ['6', 'Write Description', 'Detailed explanation of the issue'],
      ['7', 'Attach Files', 'Optional: images or documents'],
      ['8', 'Submit Ticket', 'Sent to approver for review automatically'],
    ];

    steps.forEach((s, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i % 4;
      stepBox(s[0], s[1], s[2], 14 + col * 140, 38 + row * 38, 130);
    });

    infoBox('After submission, tickets go through an approval process before being handled by staff. You will receive a notification once your ticket is approved or rejected.', 14, H - 38, W - 28, 22, [254, 249, 195]);

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 6 — TICKET STATUSES
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Ticket Status Lifecycle', 'How a ticket flows through the system');

    const statuses = [
      { label: 'Pending\nApproval', color: [251, 191, 36], desc: 'Ticket submitted and waiting for an approver to review it.' },
      { label: 'Approved', color: [34, 197, 94], desc: 'Approver accepted — ticket moves to staff queue.' },
      { label: 'Open', color: [59, 130, 246], desc: 'Staff can see and begin working on the ticket.' },
      { label: 'In Progress', color: [168, 85, 247], desc: 'A staff member is actively resolving the issue.' },
      { label: 'Resolved', color: [16, 185, 129], desc: 'Issue resolved. Submitter is notified.' },
      { label: 'Closed', color: [100, 116, 139], desc: 'Ticket fully closed. No further action needed.' },
    ];

    statuses.forEach((s, i) => {
      const x = 14 + (i % 3) * 90;
      const y = 40 + Math.floor(i / 3) * 68;
      doc.setFillColor(...s.color.map(v => Math.min(255, v + 180 - (v > 128 ? 60 : 0))));
      doc.roundedRect(x, y, 82, 56, 3, 3, 'F');
      doc.setFillColor(...s.color);
      doc.roundedRect(x, y, 82, 18, 3, 3, 'F');
      const lines = s.label.split('\n');
      text(lines[0], x + 41, y + (lines.length > 1 ? 9 : 11), { size: 10, bold: true, color: WHITE, align: 'center' });
      if (lines[1]) text(lines[1], x + 41, y + 16, { size: 10, bold: true, color: WHITE, align: 'center' });
      text(s.desc, x + 5, y + 28, { size: 8.5, color: SLATE, maxWidth: 72 });
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 7 — APPROVAL QUEUE
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Approval Queue — Approver Guide', 'How ticket requests are reviewed and actioned');

    sideBar(55);
    text('APPROVER', 27, 60, { size: 11, bold: true, color: WHITE, align: 'center' });
    text('ROLE', 27, 68, { size: 11, bold: true, color: WHITE, align: 'center' });
    text('Access:', 10, 82, { size: 8, bold: true, color: [220, 252, 231] });
    ['Approval', 'Queue page', 'only'].forEach((t, i) => text(t, 27, 91 + i * 8, { size: 8, color: WHITE, align: 'center' }));

    const approvalSteps = [
      ['Review Pending Tickets', 'Open the Approval Queue from the top nav. Pending tab shows all tickets awaiting your decision.'],
      ['Click a Ticket', 'Select any ticket card to open the full details panel with description, priority, and attachments.'],
      ['Approve', 'Click the green Approve button. A confirmation dialog appears. SLA timers start automatically once approved.'],
      ['Reject', 'Click the red Reject button. You must provide a clear rejection reason. The submitter is notified immediately.'],
      ['Add Comments', 'Use the comment section to ask for more information before making a decision.'],
    ];

    approvalSteps.forEach((s, i) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(62, 38 + i * 30, W - 76, 25, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(62, 38 + i * 30, 10, 25, 2, 2, 'F');
      text(String(i + 1), 67, 38 + i * 30 + 14, { size: 9, bold: true, color: WHITE, align: 'center' });
      text(s[0], 76, 38 + i * 30 + 10, { size: 10, bold: true, color: DARK });
      text(s[1], 76, 38 + i * 30 + 19, { size: 8.5, color: SLATE, maxWidth: W - 90 });
    });

    infoBox('Rejected tickets display the rejection reason to the submitter. Always provide a helpful and constructive reason.', 62, H - 28, W - 76, 16, [254, 226, 226]);

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 8 — DEPARTMENT DASHBOARD
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Department Dashboard — Dept Head Guide', 'Real-time visibility into department performance');

    const metrics = [
      { label: 'Open Tickets', color: [59, 130, 246], desc: 'Total open + in-progress' },
      { label: 'Closed Tickets', color: [34, 197, 94], desc: 'Resolved + closed' },
      { label: 'Avg Resolution', color: [168, 85, 247], desc: 'Average hours to close' },
      { label: 'Team Members', color: [251, 191, 36], desc: 'Users in department' },
    ];

    metrics.forEach((m, i) => {
      const x = 14 + i * 68;
      doc.setFillColor(...m.color);
      doc.roundedRect(x, 38, 60, 28, 3, 3, 'F');
      text(m.label, x + 30, 51, { size: 8.5, bold: true, color: WHITE, align: 'center' });
      text(m.desc, x + 30, 60, { size: 7.5, color: [220, 252, 231], align: 'center' });
    });

    text('Dashboard Features:', 14, 80, { size: 12, bold: true, color: DARK });
    const features = [
      ['Tickets by Status Chart', 'Bar chart showing distribution of tickets across all statuses. Hover to see exact counts.'],
      ['Team Members Panel', 'Right-side panel listing all department members with their role badge (Head / Member).'],
      ['Recent Tickets Table', 'Bottom table showing 10 latest tickets: title, status, priority, assigned staff, and date.'],
      ['Reports Access', 'Department Heads also have access to the Reports page for detailed analytics and CSV export.'],
    ];

    features.forEach((f, i) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 86 + i * 26, W - 28, 22, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.circle(24, 86 + i * 26 + 11, 3.5, 'F');
      text(f[0], 32, 86 + i * 26 + 9, { size: 10, bold: true, color: DARK });
      text(f[1], 32, 86 + i * 26 + 17, { size: 8.5, color: SLATE, maxWidth: W - 45 });
    });

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 9 — ADMIN PANEL: DEPARTMENTS & CATEGORIES
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Admin Panel — Departments & Categories', 'Managing organizational structure and ticket classification');

    text('Departments Tab', 14, 42, { size: 13, bold: true, color: DARK });
    const deptSteps = [
      ['View All Departments', 'Listed with name, description, and active/inactive status'],
      ['Add Department', 'Click "Add Department", fill name and optional description, save'],
      ['Edit Department', 'Click pencil icon, update details, save changes'],
      ['Toggle Active', 'Inactive departments are hidden from ticket submission form'],
      ['Delete', 'Trash icon with confirmation dialog'],
    ];
    deptSteps.forEach((s, i) => stepBox(i + 1, s[0], s[1], 14, 48 + i * 26, 128));

    text('Categories Tab', 152, 42, { size: 13, bold: true, color: DARK });
    const catSteps = [
      ['View Categories', 'Listed with name, description, and status'],
      ['Add Category', '"Add Category" button — fill name and description'],
      ['Edit Category', 'Edit icon to update any category details'],
      ['Toggle Active', 'Only active categories shown in ticket form'],
      ['Delete', 'Trash icon with confirmation — permanent action'],
    ];
    catSteps.forEach((s, i) => stepBox(i + 1, s[0], s[1], 152, 48 + i * 26, 131));

    infoBox('Deactivating a department/category prevents its use in new tickets but does not affect existing tickets.', 14, H - 28, W - 28, 16, [254, 249, 195]);

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 10 — ADMIN PANEL: USERS
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Admin Panel — User Management', 'Controlling access, roles, and user accounts');

    const userTypes = [
      { label: 'Admin', color: [239, 68, 68] },
      { label: 'Dept. Head', color: [249, 115, 22] },
      { label: 'Approver', color: [234, 179, 8] },
      { label: 'Staff', color: [59, 130, 246] },
      { label: 'User', color: [100, 116, 139] },
    ];

    text('User Types:', 14, 42, { size: 12, bold: true, color: DARK });
    userTypes.forEach((u, i) => {
      doc.setFillColor(...u.color);
      doc.roundedRect(14 + i * 56, 46, 50, 14, 2, 2, 'F');
      text(u.label, 39 + i * 56, 55, { size: 9, bold: true, color: WHITE, align: 'center' });
    });

    text('User Management Actions:', 14, 72, { size: 12, bold: true, color: DARK });
    const userActions = [
      ['Search Users', 'Use the search bar to filter by name, email, or department in real-time.'],
      ['Edit a User', 'Pencil icon → update full name, user type, department → Save Changes.'],
      ['Invite a User', 'Invite by email — they receive an access link to register and join the system.'],
      ['Delete a User', 'Trash icon → confirmation dialog → permanent deletion. Cannot be undone.'],
    ];
    userActions.forEach((a, i) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 78 + i * 26, W - 28, 22, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(14, 78 + i * 26, 6, 22, 2, 2, 'F');
      text(a[0], 24, 78 + i * 26 + 9, { size: 10, bold: true, color: DARK });
      text(a[1], 24, 78 + i * 26 + 17, { size: 8.5, color: SLATE, maxWidth: W - 36 });
    });

    infoBox('CRITICAL: Deleting a user is permanent and cannot be undone. The user immediately loses system access.', 14, H - 28, W - 28, 16, [254, 226, 226]);

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 11 — SLA POLICIES
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Admin Panel — SLA Policies', 'Service Level Agreement configuration and breach handling');

    text('What is an SLA?', 14, 42, { size: 13, bold: true, color: DARK });
    text('An SLA (Service Level Agreement) defines the maximum time allowed for a first response and full resolution of a ticket, based on its priority level.', 14, 50, { size: 9.5, color: SLATE, maxWidth: 270 });

    const priorities = [
      { label: 'Urgent', color: [239, 68, 68], response: '1 hr', resolution: '4 hrs' },
      { label: 'High', color: [249, 115, 22], response: '4 hrs', resolution: '8 hrs' },
      { label: 'Medium', color: [234, 179, 8], response: '8 hrs', resolution: '24 hrs' },
      { label: 'Low', color: [100, 116, 139], response: '24 hrs', resolution: '72 hrs' },
    ];

    text('Typical SLA Targets:', 14, 64, { size: 11, bold: true, color: DARK });

    // Table header
    doc.setFillColor(...DARK);
    doc.rect(14, 68, W - 28, 12, 'F');
    text('Priority', 30, 76, { size: 9, bold: true, color: WHITE });
    text('First Response', 110, 76, { size: 9, bold: true, color: WHITE });
    text('Resolution Time', 180, 76, { size: 9, bold: true, color: WHITE });
    text('Auto-Escalate', 240, 76, { size: 9, bold: true, color: WHITE });

    priorities.forEach((p, i) => {
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      doc.rect(14, 80 + i * 14, W - 28, 14, 'F');
      doc.setFillColor(...p.color);
      doc.roundedRect(16, 82 + i * 14, 28, 10, 1.5, 1.5, 'F');
      text(p.label, 30, 89 + i * 14, { size: 8.5, bold: true, color: WHITE, align: 'center' });
      text(p.response, 110, 89 + i * 14, { size: 9, color: SLATE });
      text(p.resolution, 180, 89 + i * 14, { size: 9, color: SLATE });
      text('Yes — Email alert', 240, 89 + i * 14, { size: 9, color: SLATE });
    });

    text('SLA Actions:', 14, 142, { size: 11, bold: true, color: DARK });
    const slaActions = [
      'SLA timers start automatically when a ticket is approved',
      'Breached SLAs are marked with a red indicator on the ticket card',
      'Auto-escalation emails are sent to the configured escalation address',
      'SLA policies can be set per priority and optionally per department',
    ];
    slaActions.forEach((a, i) => bullet(a, 14, 150 + i * 10, 265));

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 12 — NOTIFICATIONS
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Notification System', 'Real-time alerts for all users');

    const notifs = [
      { title: 'Ticket Approved', who: 'Submitter', desc: 'Notified when their ticket is approved by the approver and moves to Open status.' },
      { title: 'Ticket Rejected', who: 'Submitter', desc: 'Notified when their ticket is rejected, with the reason provided by the approver.' },
      { title: 'Ticket Assigned', who: 'Submitter + Staff', desc: 'Both the submitter and the assigned staff member receive an assignment notification.' },
      { title: 'Status Changed', who: 'Submitter', desc: 'Notified whenever the ticket status is updated (In Progress, Resolved, Closed).' },
      { title: 'New Comment', who: 'Submitter + Staff', desc: 'Both parties are notified when a new comment is added to the ticket discussion.' },
      { title: 'SLA Breach', who: 'Admin / Staff', desc: 'Alert when a ticket exceeds the SLA response or resolution time target.' },
    ];

    notifs.forEach((n, i) => {
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      const x = 14 + col * 141;
      const ny = 38 + row * 52;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, ny, 133, 46, 3, 3, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(x, ny, 133, 14, 3, 3, 'F');
      text('🔔', x + 6, ny + 10, { size: 9, color: WHITE });
      text(n.title, x + 16, ny + 10, { size: 10, bold: true, color: WHITE });
      badge(n.who, x + 133 - doc.getTextWidth(n.who) - 12, ny + 5.5, GREEN);
      text(n.desc, x + 5, ny + 24, { size: 8.5, color: SLATE, maxWidth: 123 });
    });

    text('Accessing Notifications:', 14, H - 32, { size: 10, bold: true, color: DARK });
    text('Click the bell icon (🔔) in the top navigation bar. Unread notifications are shown with a green badge count. Click any notification to go directly to the related ticket.', 14, H - 24, { size: 8.5, color: SLATE, maxWidth: W - 28 });

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 13 — REPORTS PAGE
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Reports Page', 'Analytics and insights for Admin and Department Heads');

    const charts = [
      { title: 'Tickets by Status', desc: 'Pie/bar chart showing count per status (Open, In Progress, Resolved, Closed)', color: [59, 130, 246] },
      { title: 'Tickets by Priority', desc: 'Distribution of tickets across Low, Medium, High, and Urgent priorities', color: [239, 68, 68] },
      { title: 'Tickets by Department', desc: 'Which departments receive the most support requests', color: [168, 85, 247] },
      { title: 'Tickets by Category', desc: 'Breakdown of ticket types to identify common issues', color: [251, 191, 36] },
      { title: 'Resolution Time', desc: 'Average time taken to resolve tickets per department or category', color: [34, 197, 94] },
      { title: 'User Workload', desc: 'Staff assignment distribution — who has the most tickets assigned', color: [249, 115, 22] },
    ];

    charts.forEach((c, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = 14 + col * 94;
      const cy = 38 + row * 72;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cx, cy, 86, 64, 3, 3, 'F');
      doc.setFillColor(...c.color);
      doc.roundedRect(cx, cy, 86, 16, 3, 3, 'F');
      text(c.title, cx + 43, cy + 10, { size: 9, bold: true, color: WHITE, align: 'center' });
      // mini chart icon
      doc.setFillColor(...c.color.map(v => Math.min(255, v + 100)));
      doc.rect(cx + 8, cy + 30, 8, 20, 'F');
      doc.rect(cx + 20, cy + 22, 8, 28, 'F');
      doc.rect(cx + 32, cy + 26, 8, 24, 'F');
      doc.rect(cx + 44, cy + 18, 8, 32, 'F');
      text(c.desc, cx + 5, cy + 55, { size: 7.5, color: SLATE, maxWidth: 76 });
    });

    infoBox('Reports are accessible to Admin and Department Heads only. Use the export button to download data as CSV.', 14, H - 28, W - 28, 16, [240, 253, 244]);

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 14 — AUDIT SYSTEM
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(WHITE);
    headerBar('Audit System', 'Store checklists, scoring, and performance ranking');

    text('What is the Audit System?', 14, 42, { size: 13, bold: true, color: DARK });
    text(
      'Store managers and QA staff complete digital checklist audits (e.g. Opening, Mid-shift, Closing) per brand and store. Each audit is scored automatically and feeds into store performance rankings.',
      14, 50, { size: 9.5, color: SLATE, maxWidth: 270 }
    );

    const auditFeatures = [
      ['Audit Templates', 'Admin builds checklists with sections & items, optional required photos and time windows'],
      ['Store Assignments', 'Templates restricted to specific brands/stores or assigned directly to individual users'],
      ['Audit Submission', 'Users answer Yes/No/NA per item, attach photos, add comments, and capture signatures'],
      ['Auto Scoring', 'Score % calculated from Yes/No/NA counts as each audit is submitted'],
      ['Store Ranking', 'Stores ranked by average audit score for healthy competition and accountability'],
      ['Audit Dashboard', 'QA/Admin view all submissions, scores, and trends across stores and brands'],
    ];

    auditFeatures.forEach((f, i) => {
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      const x = 14 + col * 141;
      const ay = 68 + row * 40;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, ay, 133, 34, 3, 3, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(x, ay, 133, 12, 3, 3, 'F');
      text(f[0], x + 66.5, ay + 8.5, { size: 9.5, bold: true, color: DARK, align: 'center' });
      text(f[1], x + 5, ay + 20, { size: 8, color: SLATE, maxWidth: 123 });
    });

    infoBox('Time-restricted templates can only be filled within a set daily window (e.g. 6am–7pm), ensuring audits happen at the right time of day.', 14, H - 28, W - 28, 16, [240, 253, 244]);

    // ════════════════════════════════════════════════════════════════════════════
    // SLIDE 15 — SUMMARY & CLOSING
    // ════════════════════════════════════════════════════════════════════════════
    newSlide(DARK);

    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 8, 'F');
    doc.rect(0, H - 8, W, 8, 'F');

    text('Summary & Key Benefits', W / 2, 26, { size: 22, bold: true, color: WHITE, align: 'center' });
    text('The HelpDesk System delivers a complete, structured, and auditable support workflow.', W / 2, 36, { size: 10, color: [148, 163, 184], align: 'center' });

    const benefits = [
      { icon: '✓', title: 'Structured Workflow', desc: 'Every ticket follows a defined approval → assignment → resolution path' },
      { icon: '✓', title: 'SLA Accountability', desc: 'Automatic timers and breach alerts keep teams on track' },
      { icon: '✓', title: 'Role-Based Access', desc: '5 user roles ensure the right people see the right information' },
      { icon: '✓', title: 'Real-Time Notifications', desc: 'All stakeholders are kept informed at every step' },
      { icon: '✓', title: 'Admin Control', desc: 'Full management of users, departments, categories, and SLA policies' },
      { icon: '✓', title: 'Reporting & Analytics', desc: 'Comprehensive charts and CSV exports for management review' },
      { icon: '✓', title: 'Store Audits', desc: 'Digital checklists with scoring, photos, and store rankings' },
    ];

    benefits.forEach((b, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i % 4;
      const bx = 20 + col * 136;
      const by = 40 + row * 34;
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(bx, by, 128, 28, 3, 3, 'F');
      doc.setFillColor(...GREEN);
      doc.circle(bx + 10, by + 11, 5.5, 'F');
      text(b.icon, bx + 10, by + 13.5, { size: 9, bold: true, color: DARK, align: 'center' });
      text(b.title, bx + 20, by + 11, { size: 9.5, bold: true, color: WHITE });
      text(b.desc, bx + 20, by + 19, { size: 7.5, color: [148, 163, 184], maxWidth: 100 });
    });

    text('Thank you for your time.', W / 2, H - 20, { size: 13, bold: true, color: GREEN, align: 'center' });
    text('HelpDesk System — Figaro Coffee Group', W / 2, H - 12, { size: 9, color: [148, 163, 184], align: 'center' });

    // ─── Output ─────────────────────────────────────────────────────────────────
    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=HelpDesk_Management_Presentation.pdf',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});