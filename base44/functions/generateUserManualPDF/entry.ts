import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.user_type !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210;
    const H = 297;
    const MARGIN = 14;

    const GREEN = [31, 214, 85];
    const DARK = [15, 23, 42];
    const SLATE = [71, 85, 105];
    const WHITE = [255, 255, 255];
    const LIGHT = [248, 250, 252];
    const LIGHT_GREEN = [240, 253, 244];

    // ─── helpers ────────────────────────────────────────────────────────────────
    function txt(str, x, y, opts) {
      const o = opts || {};
      doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
      doc.setFontSize(o.size || 10);
      doc.setTextColor(...(o.color || DARK));
      doc.text(String(str), x, y, { align: o.align || 'left', maxWidth: o.maxWidth });
    }

    function pageHeader(title, subtitle, color) {
      const c = color || GREEN;
      doc.setFillColor(...c);
      doc.rect(0, 0, W, 28, 'F');
      // accent line
      doc.setFillColor(...GREEN);
      doc.rect(0, 28, W, 2, 'F');
      txt(title, MARGIN, 13, { size: 16, bold: true, color: WHITE });
      if (subtitle) txt(subtitle, MARGIN, 22, { size: 8.5, color: [220, 252, 231] });
      // page footer
      doc.setFillColor(...DARK);
      doc.rect(0, H - 12, W, 12, 'F');
      txt('HelpDesk System — User Manual & Guide', W / 2, H - 5, { size: 7, color: [148, 163, 184], align: 'center' });
    }

    function sectionTitle(label, y) {
      doc.setFillColor(...GREEN);
      doc.rect(MARGIN, y, 4, 7, 'F');
      txt(label, MARGIN + 7, y + 5.5, { size: 12, bold: true, color: DARK });
      return y + 12;
    }

    function stepRow(num, title, desc, y) {
      doc.setFillColor(...GREEN);
      doc.circle(MARGIN + 4, y + 4, 4, 'F');
      txt(String(num), MARGIN + 4, y + 6, { size: 8, bold: true, color: WHITE, align: 'center' });
      txt(title, MARGIN + 11, y + 4, { size: 9.5, bold: true, color: DARK });
      if (desc) txt(desc, MARGIN + 11, y + 10, { size: 8, color: SLATE, maxWidth: W - MARGIN - 15 });
      return y + (desc ? 16 : 11);
    }

    function infoBox(text, y, type) {
      const colors = {
        info: [[219, 234, 254], [30, 58, 138]],
        warning: [[254, 249, 195], [133, 77, 14]],
        success: [[220, 252, 231], [20, 83, 45]],
        danger: [[254, 226, 226], [153, 27, 27]],
      };
      const [bg, fg] = colors[type || 'info'];
      const lines = doc.splitTextToSize(text, W - MARGIN * 2 - 8);
      const boxH = lines.length * 5 + 8;
      doc.setFillColor(...bg);
      doc.roundedRect(MARGIN, y, W - MARGIN * 2, boxH, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...fg);
      doc.text(lines, MARGIN + 4, y + 6);
      return y + boxH + 4;
    }

    function bullet(text, y) {
      doc.setFillColor(...GREEN);
      doc.circle(MARGIN + 2, y - 1, 1.3, 'F');
      txt(text, MARGIN + 7, y + 0.5, { size: 9, color: SLATE, maxWidth: W - MARGIN - 10 });
      return y + 7;
    }

    function badge(label, x, y, bgColor, textColor) {
      const bg = bgColor || GREEN;
      const tc = textColor || DARK;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      const tw = doc.getTextWidth(label);
      doc.setFillColor(...bg);
      doc.roundedRect(x, y - 4, tw + 6, 6.5, 1.5, 1.5, 'F');
      doc.setTextColor(...tc);
      doc.text(label, x + 3, y);
    }

    function addPage() {
      doc.addPage();
    }

    // ─── Fetch screenshot from the app ──────────────────────────────────────────
    async function fetchScreenshot(url) {
      try {
        const res = await fetch(`https://api.screenshotone.com/take?url=${encodeURIComponent(url)}&viewport_width=1280&viewport_height=800&format=jpg&image_quality=75&delay=2`, {
          headers: { 'Accept': 'image/jpeg' }
        });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        return 'data:image/jpeg;base64,' + b64;
      } catch {
        return null;
      }
    }

    function addScreenshotPlaceholder(doc, x, y, w, h, label) {
      doc.setFillColor(230, 240, 255);
      doc.roundedRect(x, y, w, h, 3, 3, 'F');
      doc.setDrawColor(180, 200, 230);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, w, h, 3, 3, 'S');
      // inner "screen" frame
      doc.setFillColor(200, 220, 250);
      doc.roundedRect(x + 4, y + 4, w - 8, h - 8, 2, 2, 'F');
      // icon
      doc.setFillColor(...GREEN);
      doc.rect(x + w/2 - 8, y + h/2 - 10, 16, 12, 'F');
      doc.setFillColor(255, 255, 255);
      doc.rect(x + w/2 - 4, y + h/2 - 6, 8, 4, 'F');
      txt(label || 'App Screenshot', x + w/2, y + h/2 + 8, { size: 7.5, color: SLATE, align: 'center' });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // PAGE 1 — COVER
    // ════════════════════════════════════════════════════════════════════════════
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, H, 'F');

    doc.setFillColor(...GREEN);
    doc.rect(0, 0, 8, H, 'F');
    doc.rect(0, H - 10, W, 10, 'F');

    // Logo box
    doc.setFillColor(...GREEN);
    doc.roundedRect(20, 40, 24, 24, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text('HD', 32, 55, { align: 'center' });

    txt('HelpDesk System', 52, 58, { size: 26, bold: true, color: WHITE });
    txt('User Manual & Guide', 52, 70, { size: 13, color: GREEN });
    txt('Figaro Coffee Group', 52, 80, { size: 10, color: [148, 163, 184] });

    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.line(52, 86, 195, 86);

    txt('Complete role-based guide for all system users:', 52, 96, { size: 9, color: [203, 213, 225] });

    const covers = [
      ['User Guide', 'Submit & manage support tickets'],
      ['Admin Manual', 'Manage departments, users, SLA'],
      ['Approval Queue', 'Review & action ticket requests'],
      ['Dept. Dashboard', 'Monitor team performance'],
    ];

    covers.forEach((c, i) => {
      const y = 104 + i * 20;
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(52, y, 140, 14, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(52, y, 4, 14, 1, 1, 'F');
      txt(c[0], 60, y + 6, { size: 9, bold: true, color: WHITE });
      txt(c[1], 60, y + 11, { size: 7.5, color: [148, 163, 184] });
    });

    txt(`Prepared: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`, 52, 192, { size: 8, color: [148, 163, 184] });
    txt('ADMIN USE ONLY — CONFIDENTIAL', W / 2, H - 4, { size: 7.5, color: GREEN, align: 'center' });

    // ════════════════════════════════════════════════════════════════════════════
    // PAGE 2 — TABLE OF CONTENTS
    // ════════════════════════════════════════════════════════════════════════════
    addPage();
    pageHeader('Table of Contents', 'What this guide covers');

    const toc = [
      ['1', 'User Guide', 'Submitting, tracking & managing tickets', '3'],
      ['2', 'Admin Manual', 'Departments, categories, users & SLA', '7'],
      ['3', 'Approval Queue', 'Reviewing & approving ticket requests', '12'],
      ['4', 'Department Dashboard', 'Monitoring team performance & metrics', '16'],
    ];

    let y = 40;
    toc.forEach(([num, title, desc, pg]) => {
      doc.setFillColor(...LIGHT);
      doc.roundedRect(MARGIN, y, W - MARGIN * 2, 22, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(MARGIN, y, 14, 22, 2, 2, 'F');
      txt(num, MARGIN + 7, y + 13, { size: 12, bold: true, color: WHITE, align: 'center' });
      txt(title, MARGIN + 18, y + 9, { size: 11, bold: true, color: DARK });
      txt(desc, MARGIN + 18, y + 16, { size: 8, color: SLATE });
      txt(`Page ${pg}`, W - MARGIN - 2, y + 13, { size: 9, bold: true, color: GREEN, align: 'right' });
      y += 28;
    });

    y += 10;
    infoBox('This guide is intended for all users of the HelpDesk System at Figaro Coffee Group. Each section covers a specific role: regular users, administrators, approvers, and department heads.', y, 'info');

    // ════════════════════════════════════════════════════════════════════════════
    // SECTION 1 — USER GUIDE (Pages 3-6)
    // ════════════════════════════════════════════════════════════════════════════

    // Page 3 — User Guide Intro + Submit Steps
    addPage();
    pageHeader('Section 1: User Guide', 'How regular users submit and manage support tickets', [30, 41, 59]);

    y = 36;
    y = sectionTitle('Overview', y);
    txt('As a regular user, you can submit support tickets for any internal issues or requests. The Home page is your main workspace where you can create, view, search, and track all your tickets.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 16;

    y = infoBox('Tickets go through an approval process before being handled by staff. You will be notified at each stage via the bell icon in the navigation bar.', y, 'info');

    // Visual: Home page mockup
    doc.setFillColor(235, 245, 255);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 55, 3, 3, 'F');
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 3, 3, 'F');
    txt('HelpDesk — Home Page', MARGIN + 4, y + 7, { size: 7.5, bold: true, color: WHITE });
    // Nav bar simulation
    doc.setFillColor(...GREEN);
    doc.roundedRect(W - MARGIN - 30, y + 2, 28, 6, 1, 1, 'F');
    txt('+ New Ticket', W - MARGIN - 16, y + 7, { size: 6.5, bold: true, color: DARK, align: 'center' });
    // Ticket cards simulation
    [0, 1, 2].forEach(i => {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(MARGIN + 2, y + 14 + i * 13, W - MARGIN * 2 - 4, 11, 1.5, 1.5, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(MARGIN + 2, y + 14 + i * 13, 3, 11, 1, 1, 'F');
      txt(['[IT] Printer not working', '[HR] Leave request', '[Maintenance] AC repair'][i], MARGIN + 8, y + 21 + i * 13, { size: 7.5, bold: true, color: DARK });
      const statColors = [[59, 130, 246], [234, 179, 8], [34, 197, 94]];
      const statLabels = ['Open', 'Pending Approval', 'Resolved'];
      badge(statLabels[i], W - MARGIN - 32, y + 18 + i * 13, statColors[i], WHITE);
    });
    txt('📱 Home Page — Your Ticket Dashboard', MARGIN, y + 53, { size: 7, color: SLATE, italic: true });
    y += 59;

    y = sectionTitle('How to Submit a New Ticket', y);
    y = stepRow(1, 'Click "New Ticket"', 'Find the green "+ New Ticket" button in the top-right of the Home page.', y);
    y = stepRow(2, 'Enter a Title', 'Write a short, clear summary of your issue (e.g. "Printer not working in Room 3").', y);
    y = stepRow(3, 'Select a Department', 'Choose the department that handles your request (e.g. IT, HR, Maintenance).', y);
    y = stepRow(4, 'Select a Category', 'Pick the category that best describes the type of issue.', y);
    y = stepRow(5, 'Set Priority', 'Choose Low, Medium, High, or Urgent based on urgency.', y);

    // Page 4 — More submit steps + form mockup
    addPage();
    pageHeader('Section 1: User Guide', 'Submitting a Ticket — continued', [30, 41, 59]);

    y = 36;

    // Form visual mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 75, 3, 3, 'F');
    doc.setFillColor(...DARK);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 3, 3, 'F');
    txt('New Ticket Form', MARGIN + 4, y + 7, { size: 8, bold: true, color: WHITE });
    // Form fields
    const fields = [
      ['Title *', 'Printer not working in Office B'],
      ['Department *', 'IT Department'],
      ['Category *', 'Hardware'],
      ['Priority *', 'High'],
    ];
    fields.forEach((f, i) => {
      const fy = y + 14 + i * 14;
      txt(f[0], MARGIN + 4, fy + 4, { size: 7, bold: true, color: SLATE });
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(MARGIN + 4, fy + 5, W - MARGIN * 2 - 8, 8, 1, 1, 'F');
      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.3);
      doc.roundedRect(MARGIN + 4, fy + 5, W - MARGIN * 2 - 8, 8, 1, 1, 'S');
      txt(f[1], MARGIN + 6, fy + 11, { size: 7, color: [100, 116, 139] });
    });
    // Description field
    const dy = y + 14 + 4 * 14;
    txt('Description *', MARGIN + 4, dy + 4, { size: 7, bold: true, color: SLATE });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN + 4, dy + 5, W - MARGIN * 2 - 8, 10, 1, 1, 'F');
    doc.roundedRect(MARGIN + 4, dy + 5, W - MARGIN * 2 - 8, 10, 1, 1, 'S');
    txt('The printer in Office B Room 3 is not responding...', MARGIN + 6, dy + 11, { size: 7, color: [100, 116, 139] });
    // Submit button
    doc.setFillColor(...GREEN);
    doc.roundedRect(MARGIN + 4, y + 63, 35, 8, 1.5, 1.5, 'F');
    txt('Submit Ticket', MARGIN + 21, y + 68.5, { size: 7, bold: true, color: DARK, align: 'center' });
    txt('📋 Ticket Submission Form', MARGIN, y + 76, { size: 7, color: SLATE, italic: true });
    y += 82;

    y = stepRow(6, 'Write a Detailed Description', 'Explain the issue clearly. Include when it happened, what you tried, and any error messages.', y);
    y = stepRow(7, 'Attach Files (Optional)', 'Upload images or documents that help explain the issue.', y);
    y = stepRow(8, 'Click "Submit Ticket"', 'Your ticket is sent to an approver for review. You will get a notification once actioned.', y);
    y += 3;
    y = infoBox('After submitting, your ticket status will show as "Pending Approval" until an approver reviews it. You cannot edit a ticket after submission.', y, 'warning');

    // Page 5 — Tracking + Statuses
    addPage();
    pageHeader('Section 1: User Guide', 'Tracking Tickets & Understanding Statuses', [30, 41, 59]);
    y = 36;

    y = sectionTitle('Ticket Status Lifecycle', y);
    txt('Each ticket moves through a series of statuses from submission to closure:', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 8;

    const statuses = [
      ['Pending Approval', [251, 191, 36], 'Submitted. Waiting for an approver to review your request.'],
      ['Open', [59, 130, 246], 'Approved. Staff can see and begin working on your ticket.'],
      ['In Progress', [168, 85, 247], 'A staff member is actively resolving your issue.'],
      ['Resolved', [16, 185, 129], 'Issue resolved. You will receive a notification.'],
      ['Closed', [100, 116, 139], 'Ticket fully closed. No further action needed.'],
      ['Rejected', [239, 68, 68], 'Approver rejected your request. Reason is provided.'],
    ];

    statuses.forEach(([label, color, desc]) => {
      doc.setFillColor(...color.map(v => Math.min(255, v + 140)));
      doc.roundedRect(MARGIN, y, W - MARGIN * 2, 12, 2, 2, 'F');
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN, y, 3, 12, 1, 1, 'F');
      badge(label, MARGIN + 6, y + 8, color, WHITE);
      txt(desc, MARGIN + 44, y + 8, { size: 8, color: SLATE });
      y += 15;
    });

    y += 4;
    y = sectionTitle('Searching & Filtering Your Tickets', y);
    // Search bar mockup
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 12, 2, 2, 'F');
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 12, 2, 2, 'S');
    txt('🔍  Search tickets...', MARGIN + 4, y + 8, { size: 8, color: [148, 163, 184] });
    // Filter dropdowns
    ['Status: All', 'Category: All'].forEach((f, i) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(MARGIN + i * 50, y + 14, 44, 8, 1.5, 1.5, 'F');
      doc.roundedRect(MARGIN + i * 50, y + 14, 44, 8, 1.5, 1.5, 'S');
      txt(f, MARGIN + i * 50 + 4, y + 20, { size: 7, color: SLATE });
    });
    txt('🔎 Search and Filter Bar', MARGIN, y + 24, { size: 7, color: SLATE, italic: true });
    y += 30;

    y = bullet('Use the search bar to find tickets by title keyword', y);
    y = bullet('Use "Status" dropdown to show only Open, Resolved, etc.', y);
    y = bullet('Use "Category" dropdown to filter by ticket type', y);
    y += 6;

    y = sectionTitle('Notifications', y);
    y = bullet('Bell icon (🔔) in the top navigation shows your unread count', y);
    y = bullet('Notified when ticket is approved or rejected', y);
    y = bullet('Notified when a staff member is assigned', y);
    y = bullet('Notified on every status change and new comment', y);
    y += 4;
    infoBox('Click the bell icon to see all your notifications. Clicking any notification takes you directly to that ticket.', y, 'success');

    // Page 6 — Viewing Ticket Details
    addPage();
    pageHeader('Section 1: User Guide', 'Viewing Ticket Details & Adding Comments', [30, 41, 59]);
    y = 36;

    y = sectionTitle('Opening a Ticket', y);
    txt('Click on any ticket card on the Home page to open the full detail view.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 8;

    // Ticket detail mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 100, 3, 3, 'F');
    doc.setFillColor(...DARK);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 12, 3, 3, 'F');
    txt('Ticket Detail View', MARGIN + 4, y + 8, { size: 8.5, bold: true, color: WHITE });
    // Ticket title
    txt('[IT] Printer not working in Office B', MARGIN + 4, y + 20, { size: 10, bold: true, color: DARK });
    // Status + Priority badges
    badge('In Progress', MARGIN + 4, y + 28, [168, 85, 247], WHITE);
    badge('High Priority', MARGIN + 40, y + 28, [249, 115, 22], WHITE);
    badge('IT Department', MARGIN + 76, y + 28, [59, 130, 246], WHITE);
    // Info row
    txt('Assigned to: John Cruz  |  Submitted: Feb 20, 2026  |  SLA: 4hrs remaining', MARGIN + 4, y + 36, { size: 7.5, color: SLATE });
    // Divider
    doc.setDrawColor(220, 230, 240); doc.setLineWidth(0.3);
    doc.line(MARGIN + 2, y + 40, W - MARGIN - 2, y + 40);
    // Description
    txt('Description:', MARGIN + 4, y + 47, { size: 8, bold: true, color: DARK });
    txt('The printer in Office B Room 3 is not responding since this morning. I tried restarting it but nothing happened. Error code: 0x45A appears on the screen.', MARGIN + 4, y + 54, { size: 7.5, color: SLATE, maxWidth: W - MARGIN * 2 - 8 });
    // Comment section
    doc.line(MARGIN + 2, y + 68, W - MARGIN - 2, y + 68);
    txt('Discussion', MARGIN + 4, y + 75, { size: 8, bold: true, color: DARK });
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(MARGIN + 4, y + 78, W - MARGIN * 2 - 8, 14, 1.5, 1.5, 'F');
    txt('John Cruz (Staff):', MARGIN + 7, y + 84, { size: 7.5, bold: true, color: [20, 83, 45] });
    txt('I will check the printer shortly. Please standby.', MARGIN + 7, y + 90, { size: 7.5, color: SLATE });
    txt('📋 Ticket Detail Panel', MARGIN, y + 103, { size: 7, color: SLATE, italic: true });
    y += 108;

    y = stepRow(1, 'View full details', 'See title, status, priority, department, SLA timer, and description.', y);
    y = stepRow(2, 'Read staff comments', 'Scroll to the Discussion section to read messages from the support team.', y);
    y = stepRow(3, 'Add your reply', 'Type in the comment box and click "Add Comment" to respond.', y);
    y = stepRow(4, 'View attachments', 'Click on attached images or files to open them.', y);
    y += 4;
    infoBox('You can only add comments to your own tickets. You cannot modify the ticket details after submission.', y, 'info');

    // ════════════════════════════════════════════════════════════════════════════
    // SECTION 2 — ADMIN MANUAL (Pages 7-11)
    // ════════════════════════════════════════════════════════════════════════════

    // Page 7 — Admin Overview
    addPage();
    pageHeader('Section 2: Admin Manual', 'Full control of the HelpDesk system', [15, 23, 42]);
    y = 36;

    y = sectionTitle('Admin Overview', y);
    txt('As an Administrator, you have full access to the system. The Admin Panel (accessible via the "Admin" link in the navigation) contains four main management tabs:', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 14;

    // Admin nav mockup
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 14, 3, 3, 'F');
    ['Departments', 'Categories', 'Users', 'SLA Policies'].forEach((tab, i) => {
      const isActive = i === 0;
      if (isActive) {
        doc.setFillColor(...GREEN);
        doc.roundedRect(MARGIN + 4 + i * 46, y + 2, 42, 10, 1.5, 1.5, 'F');
      }
      txt(tab, MARGIN + 25 + i * 46, y + 8.5, { size: 7, bold: isActive, color: isActive ? DARK : [148, 163, 184], align: 'center' });
    });
    txt('📋 Admin Panel — Tab Navigation', MARGIN, y + 16, { size: 7, color: SLATE, italic: true });
    y += 22;

    const adminTabs = [
      { title: 'Departments', color: [59, 130, 246], desc: 'Manage organizational departments used to route tickets' },
      { title: 'Categories', color: [168, 85, 247], desc: 'Classify ticket types for easier filtering and reporting' },
      { title: 'Users', color: [249, 115, 22], desc: 'Control user accounts, roles, and department assignments' },
      { title: 'SLA Policies', color: [239, 68, 68], desc: 'Set response and resolution time targets per priority' },
    ];

    adminTabs.forEach((t, i) => {
      doc.setFillColor(...t.color.map(v => Math.min(255, v + 160)));
      doc.roundedRect(MARGIN, y, W - MARGIN * 2, 16, 2, 2, 'F');
      doc.setFillColor(...t.color);
      doc.roundedRect(MARGIN, y, 4, 16, 1, 1, 'F');
      txt(t.title, MARGIN + 8, y + 7, { size: 9.5, bold: true, color: DARK });
      txt(t.desc, MARGIN + 8, y + 13, { size: 7.5, color: SLATE });
      y += 20;
    });

    y += 4;
    infoBox('The Admin page is only accessible to users with "Admin" role. Contact the system owner to be assigned admin access.', y, 'warning');

    // Page 8 — Departments
    addPage();
    pageHeader('Section 2: Admin Manual', 'Managing Departments', [15, 23, 42]);
    y = 36;

    y = sectionTitle('Departments Tab', y);
    txt('Departments represent the teams in your organization that handle different types of support requests. Only active departments appear in the ticket form.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 14;

    // Dept list mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 70, 3, 3, 'F');
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 3, 3, 'F');
    txt('Departments', MARGIN + 4, y + 7, { size: 8, bold: true, color: WHITE });
    doc.setFillColor(...GREEN);
    doc.roundedRect(W - MARGIN - 32, y + 2, 30, 6, 1, 1, 'F');
    txt('+ Add Department', W - MARGIN - 17, y + 6.5, { size: 5.5, bold: true, color: DARK, align: 'center' });

    // Table header
    doc.setFillColor(226, 232, 240);
    doc.rect(MARGIN, y + 10, W - MARGIN * 2, 7, 'F');
    txt('Department Name', MARGIN + 4, y + 15.5, { size: 7, bold: true, color: SLATE });
    txt('Description', MARGIN + 55, y + 15.5, { size: 7, bold: true, color: SLATE });
    txt('Status', W - MARGIN - 40, y + 15.5, { size: 7, bold: true, color: SLATE });
    txt('Actions', W - MARGIN - 15, y + 15.5, { size: 7, bold: true, color: SLATE });

    const depts = [
      ['IT Department', 'Handles all tech support', true],
      ['HR', 'Human resources requests', true],
      ['Maintenance', 'Facility maintenance', true],
      ['Finance', 'Budget and finance queries', false],
    ];

    depts.forEach(([name, desc, active], i) => {
      doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
      doc.rect(MARGIN, y + 17 + i * 11, W - MARGIN * 2, 11, 'F');
      txt(name, MARGIN + 4, y + 24 + i * 11, { size: 8, bold: true, color: DARK });
      txt(desc, MARGIN + 55, y + 24 + i * 11, { size: 7, color: SLATE });
      const actColor = active ? [220, 252, 231] : [254, 226, 226];
      const actTc = active ? [20, 83, 45] : [153, 27, 27];
      badge(active ? 'Active' : 'Inactive', W - MARGIN - 40, y + 21 + i * 11, actColor, actTc);
    });

    txt('📋 Departments List with Actions', MARGIN, y + 62, { size: 7, color: SLATE, italic: true });
    y += 76;

    y = stepRow(1, 'Add a Department', 'Click "+ Add Department", enter a name and optional description, click Save.', y);
    y = stepRow(2, 'Edit a Department', 'Click the pencil ✏️ icon next to any department to update its details.', y);
    y = stepRow(3, 'Toggle Active Status', 'Use the toggle switch. Inactive departments are hidden from the ticket form.', y);
    y = stepRow(4, 'Delete a Department', 'Click the trash 🗑️ icon and confirm deletion in the dialog.', y);
    y += 2;
    infoBox('Deactivating a department prevents new tickets from being submitted to it, but does NOT affect existing tickets already in that department.', y, 'warning');

    // Page 9 — Categories + Users
    addPage();
    pageHeader('Section 2: Admin Manual', 'Managing Categories & Users', [15, 23, 42]);
    y = 36;

    y = sectionTitle('Categories Tab', y);
    txt('Categories help classify tickets by type (e.g. Hardware, Software, HR Request). Only active categories appear in the ticket form.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 12;

    y = stepRow(1, 'View All Categories', 'A list shows all categories with name, description, and active/inactive status.', y);
    y = stepRow(2, 'Add a Category', 'Click "Add Category", fill in name and optional description, then save.', y);
    y = stepRow(3, 'Edit a Category', 'Click the edit icon beside any category to update its details.', y);
    y = stepRow(4, 'Toggle Active', 'Only active categories are shown in the ticket submission form.', y);
    y = stepRow(5, 'Delete a Category', 'Use the trash icon — requires confirmation. Action is permanent.', y);
    y += 2;
    y = infoBox('Deleting a category is permanent. Consider deactivating instead to preserve historical data on existing tickets.', y, 'danger');

    y = sectionTitle('Users Tab', y);
    txt('Manage all registered users: their roles, departments, and access levels.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 8;

    // User types badges visual
    const userTypes = [
      ['Admin', [239, 68, 68]],
      ['Dept. Head', [249, 115, 22]],
      ['Approver', [234, 179, 8]],
      ['Staff', [59, 130, 246]],
      ['User', [100, 116, 139]],
    ];
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 16, 2, 2, 'F');
    txt('User Types:', MARGIN + 4, y + 6, { size: 7.5, bold: true, color: DARK });
    userTypes.forEach(([label, color], i) => {
      badge(label, MARGIN + 30 + i * 32, y + 9.5, color, WHITE);
    });
    y += 20;

    y = stepRow(1, 'Search Users', 'Use the search bar to filter by name, email, or department.', y);
    y = stepRow(2, 'Invite a User', 'Click "Invite User", enter their email and role. They receive an email invite.', y);
    y = stepRow(3, 'Edit a User', 'Click the pencil icon to update full name, user type, or department.', y);
    y = stepRow(4, 'Delete a User', 'Click the trash icon — requires confirmation. This is permanent.', y);
    y += 2;
    infoBox('IMPORTANT: Deleting a user is permanent and cannot be undone. The user immediately loses all system access.', y, 'danger');

    // Page 10 — SLA Policies
    addPage();
    pageHeader('Section 2: Admin Manual', 'SLA Policies — Service Level Agreements', [15, 23, 42]);
    y = 36;

    y = sectionTitle('What is an SLA?', y);
    txt('An SLA (Service Level Agreement) defines the maximum time allowed for a first response and full resolution of a ticket, based on its priority level. SLA timers start automatically when a ticket is approved.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 18;

    // SLA table visual
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 2, 2, 'F');
    ['Priority', 'First Response', 'Resolution Time', 'Auto-Escalate'].forEach((h, i) => {
      txt(h, MARGIN + 4 + i * 44, y + 7, { size: 7.5, bold: true, color: WHITE });
    });
    y += 10;

    const slaData = [
      ['Urgent', [239, 68, 68], '1 hour', '4 hours', 'Yes'],
      ['High', [249, 115, 22], '4 hours', '8 hours', 'Yes'],
      ['Medium', [234, 179, 8], '8 hours', '24 hours', 'Yes'],
      ['Low', [100, 116, 139], '24 hours', '72 hours', 'Yes'],
    ];

    slaData.forEach(([label, color, resp, resol, esc], i) => {
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      doc.rect(MARGIN, y, W - MARGIN * 2, 12, 'F');
      badge(label, MARGIN + 4, y + 8.5, color, WHITE);
      txt(resp, MARGIN + 48, y + 8, { size: 8, color: SLATE });
      txt(resol, MARGIN + 92, y + 8, { size: 8, color: SLATE });
      txt(esc, MARGIN + 136, y + 8, { size: 8, color: SLATE });
      y += 12;
    });
    txt('📋 Default SLA Target Table', MARGIN, y + 2, { size: 7, color: SLATE, italic: true });
    y += 10;

    y = stepRow(1, 'View SLA Policies', 'All policies listed with name, priority, response time, resolution time.', y);
    y = stepRow(2, 'Create SLA Policy', 'Click "Add SLA Policy". Set name, priority, response/resolution hours, optional escalation email.', y);
    y = stepRow(3, 'Edit an SLA', 'Click edit icon to update any field of an existing policy.', y);
    y = stepRow(4, 'Toggle Active', 'Only active SLA policies are applied to new tickets.', y);
    y = stepRow(5, 'Escalation', 'Set an "Escalate After Hours" value and email address to auto-alert on breach.', y);
    y += 2;
    y = infoBox('SLA timers start when a ticket is approved. Tickets with breached SLAs are marked with a red indicator on the ticket card. Auto-escalation emails are sent when the configured threshold is exceeded.', y, 'info');
    infoBox('You can create department-specific SLA policies by linking them to a department. These override the global SLA for that department.', y, 'success');

    // ════════════════════════════════════════════════════════════════════════════
    // SECTION 3 — APPROVAL QUEUE (Pages 12-15)
    // ════════════════════════════════════════════════════════════════════════════

    // Page 12 — Approval Queue Overview
    addPage();
    pageHeader('Section 3: Approval Queue', 'Reviewing and actioning ticket requests', [30, 64, 175]);
    y = 36;

    y = sectionTitle('Overview', y);
    txt('The Approval Queue is the workspace for users with the Approver role. All support tickets submitted by regular users must pass through approval before being handled by staff.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 14;
    y = infoBox('Access the Approval Queue from the "Approval Queue" link in the top navigation bar. This link is only visible to users with the Approver role.', y, 'info');

    // Stats mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 36, 3, 3, 'F');
    txt('Dashboard Statistics', MARGIN + 4, y + 8, { size: 8.5, bold: true, color: DARK });
    const statCards = [
      ['12', 'Pending Approval', [251, 191, 36]],
      ['34', 'Approved', [34, 197, 94]],
      ['5', 'Rejected', [239, 68, 68]],
    ];
    const cardW = (W - MARGIN * 2 - 8) / 3;
    statCards.forEach(([num, label, color], i) => {
      const cx2 = MARGIN + 4 + i * (cardW + 2);
      doc.setFillColor(...color);
      doc.roundedRect(cx2, y + 12, cardW, 18, 2, 2, 'F');
      txt(num, cx2 + cardW / 2, y + 23, { size: 14, bold: true, color: WHITE, align: 'center' });
      txt(label, cx2 + cardW / 2, y + 30, { size: 6.5, color: WHITE, align: 'center' });
    });
    txt('📊 Stats Cards — Top of Approval Queue Page', MARGIN, y + 39, { size: 7, color: SLATE, italic: true });
    y += 44;

    y = sectionTitle('Ticket Tabs', y);
    // Tab mockup
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 2, 2, 'F');
    doc.setDrawColor(220, 230, 240); doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 2, 2, 'S');
    const tabItems = ['Pending (12)', 'Approved (34)', 'Rejected (5)'];
    tabItems.forEach((t, i) => {
      if (i === 0) {
        doc.setFillColor(...GREEN);
        doc.roundedRect(MARGIN + 2 + i * 60, y + 1, 56, 8, 1.5, 1.5, 'F');
        txt(t, MARGIN + 30 + i * 60, y + 6.5, { size: 7.5, bold: true, color: DARK, align: 'center' });
      } else {
        txt(t, MARGIN + 30 + i * 60, y + 6.5, { size: 7.5, color: SLATE, align: 'center' });
      }
    });
    y += 14;
    txt('Three tabs organize tickets: Pending (awaiting decision), Approved, and Rejected.', MARGIN, y, { size: 8.5, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 10;

    y = sectionTitle('Reviewing a Ticket', y);
    y = stepRow(1, 'Go to the Pending tab', 'This shows all tickets waiting for your review and decision.', y);
    y = stepRow(2, 'Click a ticket card', 'Opens the full ticket detail panel with all information.', y);
    y = stepRow(3, 'Review the details', 'Read the title, description, priority, department, and any attachments.', y);
    y = stepRow(4, 'Check comments', 'Scroll down to see the discussion history for any prior context.', y);

    // Page 13 — Approve + Reject
    addPage();
    pageHeader('Section 3: Approval Queue', 'Approving & Rejecting Tickets', [30, 64, 175]);
    y = 36;

    // Ticket detail mockup with approve/reject buttons
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 80, 3, 3, 'F');
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 3, 3, 'F');
    txt('Ticket Detail — Approver View', MARGIN + 4, y + 7, { size: 8, bold: true, color: WHITE });
    txt('[HR] New hire onboarding request', MARGIN + 4, y + 18, { size: 10, bold: true, color: DARK });
    badge('Pending Approval', MARGIN + 4, y + 26, [251, 191, 36], [92, 64, 3]);
    badge('Medium', MARGIN + 46, y + 26, [249, 115, 22], WHITE);
    txt('Submitted by: Maria Santos  |  Dept: HR  |  Feb 23, 2026', MARGIN + 4, y + 34, { size: 7.5, color: SLATE });
    txt('Description: We have a new hire starting March 1. Please prepare the onboarding kit, system accounts, and schedule the orientation.', MARGIN + 4, y + 42, { size: 8, color: SLATE, maxWidth: W - MARGIN * 2 - 8 });
    doc.line(MARGIN + 2, y + 55, W - MARGIN - 2, y + 55);
    // Approve button
    doc.setFillColor(...GREEN);
    doc.roundedRect(MARGIN + 4, y + 60, 40, 10, 2, 2, 'F');
    txt('✓ Approve', MARGIN + 24, y + 66.5, { size: 8, bold: true, color: DARK, align: 'center' });
    // Reject button
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(MARGIN + 48, y + 60, 40, 10, 2, 2, 'F');
    txt('✗ Reject', MARGIN + 68, y + 66.5, { size: 8, bold: true, color: WHITE, align: 'center' });
    // Comment button
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(MARGIN + 92, y + 60, 50, 10, 2, 2, 'F');
    txt('💬 Add Comment', MARGIN + 117, y + 66.5, { size: 8, color: DARK, align: 'center' });
    txt('📋 Ticket Detail with Approve / Reject Actions', MARGIN, y + 83, { size: 7, color: SLATE, italic: true });
    y += 88;

    y = sectionTitle('Approving a Ticket', y);
    y = stepRow(1, 'Click the green "Approve" button', 'Visible in the ticket detail panel for all Pending tickets.', y);
    y = stepRow(2, 'Confirm the action', 'A confirmation dialog appears. Click "Yes, Approve" to proceed.', y);
    y = stepRow(3, 'SLA timers start', 'The ticket moves to Open status. SLA timers are applied automatically.', y);
    y += 2;
    y = infoBox('Once approved, the submitter receives a notification and the ticket becomes visible to staff for assignment.', y, 'success');

    y = sectionTitle('Rejecting a Ticket', y);
    y = stepRow(1, 'Click the red "Reject" button', 'Visible in the ticket detail panel for all Pending tickets.', y);
    y = stepRow(2, 'Confirm the action', 'Click "Yes, Reject" in the confirmation dialog to continue.', y);
    y = stepRow(3, 'Provide a rejection reason', 'A required text box appears. Type a clear, helpful explanation.', y);
    y = stepRow(4, 'Submit', 'Click "Submit Rejection". The submitter is notified with your reason.', y);
    y += 2;
    infoBox('Always provide a clear and constructive rejection reason. The submitter sees this message and may need to resubmit with corrections.', y, 'danger');

    // Page 14 — Commenting
    addPage();
    pageHeader('Section 3: Approval Queue', 'Adding Comments & Managing Queue', [30, 64, 175]);
    y = 36;

    y = sectionTitle('Adding Comments to a Ticket', y);
    txt('You can communicate with the ticket submitter or add notes before making a decision.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 10;

    // Comment box mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 50, 3, 3, 'F');
    txt('Discussion', MARGIN + 4, y + 8, { size: 9, bold: true, color: DARK });
    // Comment from user
    doc.setFillColor(219, 234, 254);
    doc.roundedRect(MARGIN + 4, y + 12, W - MARGIN * 2 - 8, 12, 1.5, 1.5, 'F');
    txt('Maria Santos (User):', MARGIN + 7, y + 18, { size: 7.5, bold: true, color: [30, 58, 138] });
    txt('Can this be processed by Feb 28? The new hire starts March 1.', MARGIN + 7, y + 23, { size: 7.5, color: SLATE });
    // Comment input
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN + 4, y + 27, W - MARGIN * 2 - 8, 12, 1.5, 1.5, 'F');
    doc.setDrawColor(200, 210, 220); doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN + 4, y + 27, W - MARGIN * 2 - 8, 12, 1.5, 1.5, 'S');
    txt('Type your comment here...', MARGIN + 7, y + 34, { size: 7.5, color: [148, 163, 184] });
    doc.setFillColor(...GREEN);
    doc.roundedRect(MARGIN + 4, y + 42, 30, 6, 1, 1, 'F');
    txt('Add Comment', MARGIN + 19, y + 46.5, { size: 6.5, bold: true, color: DARK, align: 'center' });
    txt('💬 Discussion & Comment Section', MARGIN, y + 52, { size: 7, color: SLATE, italic: true });
    y += 58;

    y = stepRow(1, 'Open any ticket', 'Click a ticket card in any tab (Pending, Approved, Rejected).', y);
    y = stepRow(2, 'Scroll to Discussion', 'The comment section appears below the ticket details.', y);
    y = stepRow(3, 'Write your comment', 'Type in the text box. Use comments to ask for clarification.', y);
    y = stepRow(4, 'Click "Add Comment"', 'Your comment is saved and visible to the submitter.', y);
    y += 4;
    y = infoBox('Use comments before rejecting to give submitters a chance to provide more information. This improves the approval workflow quality.', y, 'info');

    y = sectionTitle('Best Practices for Approvers', y);
    y = bullet('Review pending tickets daily to avoid SLA delays', y);
    y = bullet('Always provide specific rejection reasons, not just "Not applicable"', y);
    y = bullet('Use comments to ask for missing information before deciding', y);
    y = bullet('Check the attachment files for supporting documents', y);
    y = bullet('Prioritize Urgent and High priority tickets first', y);
    infoBox('Approved tickets automatically have SLA timers applied. Timely approvals help the support team meet their service targets.', y + 4, 'success');

    // ════════════════════════════════════════════════════════════════════════════
    // SECTION 4 — DEPARTMENT DASHBOARD (Pages 16-19)
    // ════════════════════════════════════════════════════════════════════════════

    // Page 16 — Dashboard Overview
    addPage();
    pageHeader('Section 4: Department Dashboard', 'Monitoring your team\'s performance', [88, 28, 135]);
    y = 36;

    y = sectionTitle('Overview', y);
    txt('The Department Dashboard is exclusively for users with the Department Head role. It provides a real-time view of your department\'s ticket activity, team performance, and workload distribution.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 16;
    y = infoBox('Access the Dashboard from the "Dashboard" link in the top navigation bar. This is only visible to Department Heads.', y, 'info');

    // Stats cards mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 50, 3, 3, 'F');
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 3, 3, 'F');
    txt('Department Dashboard — IT Department', MARGIN + 4, y + 7, { size: 8, bold: true, color: WHITE });

    const dashStats = [
      ['8', 'Open Tickets', [59, 130, 246]],
      ['23', 'Closed Tickets', [34, 197, 94]],
      ['6.2h', 'Avg Resolution', [168, 85, 247]],
      ['12', 'Team Members', [251, 191, 36]],
    ];
    const dw = (W - MARGIN * 2 - 10) / 4;
    dashStats.forEach(([val, label, color], i) => {
      const dx = MARGIN + 4 + i * (dw + 2);
      doc.setFillColor(...color);
      doc.roundedRect(dx, y + 14, dw, 28, 2, 2, 'F');
      txt(val, dx + dw / 2, y + 28, { size: 13, bold: true, color: WHITE, align: 'center' });
      txt(label, dx + dw / 2, y + 36, { size: 6, color: WHITE, align: 'center', maxWidth: dw - 2 });
    });
    txt('📊 Summary Stats Cards — Department Dashboard', MARGIN, y + 48, { size: 7, color: SLATE, italic: true });
    y += 56;

    y = sectionTitle('Summary Cards Explained', y);
    y = bullet('Open Tickets — total tickets currently open or in progress in your dept', y);
    y = bullet('Closed Tickets — tickets that have been resolved or closed', y);
    y = bullet('Avg Resolution Time — average hours from open to resolved', y);
    y = bullet('Team Members — count of users currently assigned to your department', y);

    // Page 17 — Charts
    addPage();
    pageHeader('Section 4: Department Dashboard', 'Tickets by Status Chart & Team Members', [88, 28, 135]);
    y = 36;

    y = sectionTitle('Tickets by Status Chart', y);
    txt('A bar chart shows the distribution of all tickets in your department across each status. Use this to quickly identify bottlenecks.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 12;

    // Bar chart mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 65, 3, 3, 'F');
    txt('Tickets by Status', MARGIN + 4, y + 8, { size: 9, bold: true, color: DARK });
    const chartBars = [
      ['Open', [59, 130, 246], 40],
      ['In Progress', [168, 85, 247], 55],
      ['Resolved', [34, 197, 94], 70],
      ['Closed', [100, 116, 139], 30],
      ['Pending', [251, 191, 36], 20],
    ];
    const barW = 22;
    const chartBase = y + 55;
    chartBars.forEach((b, i) => {
      const bx2 = MARGIN + 10 + i * (barW + 6);
      const bh = (b[2] / 100) * 40;
      doc.setFillColor(...b[1]);
      doc.roundedRect(bx2, chartBase - bh, barW, bh, 1, 1, 'F');
      txt(b[0], bx2 + barW / 2, chartBase + 5, { size: 6, color: SLATE, align: 'center' });
    });
    // y-axis
    doc.setDrawColor(220, 230, 240); doc.setLineWidth(0.3);
    doc.line(MARGIN + 8, y + 15, MARGIN + 8, chartBase);
    doc.line(MARGIN + 8, chartBase, W - MARGIN - 5, chartBase);
    txt('📊 Bar Chart — Tickets by Status', MARGIN, y + 67, { size: 7, color: SLATE, italic: true });
    y += 74;

    y = bullet('Hover over each bar to see the exact ticket count', y);
    y = bullet('A spike in "Pending" may mean approvals are delayed', y);
    y = bullet('Many "Open" tickets with few "In Progress" may indicate assignment issues', y);
    y += 6;

    y = sectionTitle('Team Members Panel', y);
    txt('The right side of the dashboard lists all users in your department with their role badge.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 10;

    // Team panel mockup
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 56, 3, 3, 'F');
    txt('Team Members', MARGIN + 4, y + 8, { size: 9, bold: true, color: DARK });
    const members = [
      ['Juan dela Cruz', 'juan@figaro.com', 'Head'],
      ['Maria Santos', 'maria@figaro.com', 'Member'],
      ['Roberto Reyes', 'roberto@figaro.com', 'Member'],
      ['Ana Gomez', 'ana@figaro.com', 'Member'],
    ];
    members.forEach((m, i) => {
      doc.setFillColor(i % 2 === 0 ? 255 : 248, 255, i % 2 === 0 ? 255 : 252);
      doc.rect(MARGIN, y + 12 + i * 11, W - MARGIN * 2, 11, 'F');
      txt(m[0], MARGIN + 4, y + 19 + i * 11, { size: 8.5, bold: true, color: DARK });
      txt(m[1], MARGIN + 60, y + 19 + i * 11, { size: 7.5, color: SLATE });
      const isHead = m[2] === 'Head';
      badge(m[2], W - MARGIN - (isHead ? 20 : 24), y + 16 + i * 11, isHead ? [31, 214, 85] : [226, 232, 240], isHead ? DARK : SLATE);
    });
    txt('👥 Team Members Panel — Department Dashboard', MARGIN, y + 58, { size: 7, color: SLATE, italic: true });
    y += 62;

    y = bullet('Department Head badge shown in green for the head user', y);
    y = bullet('Member badge shown for all other team members', y);
    y = bullet('Contact Admin to add or reassign team members', y);

    // Page 18 — Recent Tickets Table
    addPage();
    pageHeader('Section 4: Department Dashboard', 'Recent Tickets Table & Tips', [88, 28, 135]);
    y = 36;

    y = sectionTitle('Recent Tickets Table', y);
    txt('The bottom section shows the 10 most recent tickets in your department. This gives you a quick view of current activity.', MARGIN, y, { size: 9, color: SLATE, maxWidth: W - MARGIN * 2 });
    y += 12;

    // Table mockup
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, 10, 2, 2, 'F');
    ['Title', 'Status', 'Priority', 'Assigned To', 'Date'].forEach((h, i) => {
      txt(h, MARGIN + 4 + [0, 60, 95, 125, 155][i], y + 7, { size: 7, bold: true, color: WHITE });
    });
    y += 10;

    const recentTickets = [
      ['[IT] Network issue Room 5', 'In Progress', 'High', 'J. Cruz', 'Feb 23'],
      ['[IT] Software install needed', 'Open', 'Medium', 'Unassigned', 'Feb 22'],
      ['[IT] Email account setup', 'Resolved', 'Low', 'M. Santos', 'Feb 21'],
      ['[IT] Printer jam B3', 'Closed', 'Low', 'R. Reyes', 'Feb 20'],
      ['[IT] VPN access request', 'In Progress', 'Urgent', 'J. Cruz', 'Feb 19'],
    ];

    const statusC2 = { 'In Progress': [168, 85, 247], 'Open': [59, 130, 246], 'Resolved': [34, 197, 94], 'Closed': [100, 116, 139] };
    const prioC = { 'High': [249, 115, 22], 'Medium': [234, 179, 8], 'Low': [100, 116, 139], 'Urgent': [239, 68, 68] };

    recentTickets.forEach(([title, status, prio, assigned, date], i) => {
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      doc.rect(MARGIN, y, W - MARGIN * 2, 11, 'F');
      txt(title, MARGIN + 4, y + 8, { size: 7.5, color: DARK, maxWidth: 52 });
      badge(status, MARGIN + 60, y + 8.5, statusC2[status] || [100, 116, 139], WHITE);
      badge(prio, MARGIN + 95, y + 8.5, prioC[prio] || [100, 116, 139], WHITE);
      txt(assigned, MARGIN + 125, y + 8, { size: 7, color: SLATE });
      txt(date, MARGIN + 155, y + 8, { size: 7, color: SLATE });
      y += 11;
    });
    txt('📋 Recent Tickets Table — Last 10 Tickets', MARGIN, y + 3, { size: 7, color: SLATE, italic: true });
    y += 12;

    y = bullet('Title — click to open the full ticket detail', y);
    y = bullet('Status badge — color-coded for quick scanning', y);
    y = bullet('Priority — Urgent tickets should be addressed first', y);
    y = bullet('"Unassigned" means no staff member has been assigned yet', y);
    y += 6;

    y = sectionTitle('Tips for Department Heads', y);
    y = infoBox('Check the dashboard every morning to get a quick overview of your team\'s workload before starting the day.', y, 'success');
    y = infoBox('A large number of Unassigned tickets may indicate staffing issues. Contact Admin to adjust staff assignments.', y, 'warning');
    y = infoBox('Use the Reports page for longer-term analytics, trend analysis, and CSV data export.', y, 'info');
    y = bullet('Escalate urgent or long-pending tickets to Admin if needed', y);
    y = bullet('Coordinate with your team to keep the "Open" count manageable', y);

    // ════════════════════════════════════════════════════════════════════════════
    // FINAL PAGE — SUMMARY & CONTACTS
    // ════════════════════════════════════════════════════════════════════════════
    addPage();
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 8, 'F');
    doc.rect(0, H - 8, W, 8, 'F');

    txt('Thank You', W / 2, 30, { size: 24, bold: true, color: WHITE, align: 'center' });
    txt('HelpDesk System — User Manual & Guide', W / 2, 42, { size: 11, color: GREEN, align: 'center' });
    txt('Figaro Coffee Group', W / 2, 52, { size: 9, color: [148, 163, 184], align: 'center' });

    doc.setDrawColor(...GREEN); doc.setLineWidth(0.5);
    doc.line(40, 58, W - 40, 58);

    const summary = [
      ['Section 1', 'User Guide', 'Submit, track, and manage support tickets'],
      ['Section 2', 'Admin Manual', 'Full system administration and configuration'],
      ['Section 3', 'Approval Queue', 'Review, approve, and reject ticket requests'],
      ['Section 4', 'Dept. Dashboard', 'Monitor team performance and workload'],
    ];

    summary.forEach((s, i) => {
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(MARGIN, 68 + i * 30, W - MARGIN * 2, 24, 2, 2, 'F');
      doc.setFillColor(...GREEN);
      doc.roundedRect(MARGIN, 68 + i * 30, 4, 24, 1, 1, 'F');
      txt(s[0], MARGIN + 8, 68 + i * 30 + 9, { size: 7.5, color: GREEN });
      txt(s[1], MARGIN + 8, 68 + i * 30 + 16, { size: 9.5, bold: true, color: WHITE });
      txt(s[2], MARGIN + 60, 68 + i * 30 + 13, { size: 8, color: [148, 163, 184] });
    });

    txt('For technical support or access issues, contact your system administrator.', W / 2, 202, { size: 8.5, color: [148, 163, 184], align: 'center' });
    txt(`Document generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`, W / 2, 212, { size: 7.5, color: [71, 85, 105], align: 'center' });
    txt('ADMIN USE ONLY — CONFIDENTIAL', W / 2, H - 3, { size: 7, color: GREEN, align: 'center' });

    // ─── Output ─────────────────────────────────────────────────────────────────
    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=HelpDesk_User_Manual_Complete.pdf',
      },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});