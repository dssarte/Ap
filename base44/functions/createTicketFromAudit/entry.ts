import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Parse an entity timestamp (returned without a trailing "Z") as UTC.
function parseDateUtc(dateStr) {
  if (!dateStr) return null;
  const s = /Z$|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z';
  return new Date(s);
}

// Start of the current daily audit cycle for a template, in UTC, based on PHT (UTC+8).
// Mirrors the frontend getCurrentCycleStart so server and client agree on "one audit per day".
function getCycleStartUtc(template, refDateStr) {
  const ref = parseDateUtc(refDateStr);
  if (!ref) return null;
  const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const refPht = new Date(ref.getTime() + PHT_OFFSET_MS);
  if (!template.has_time_restriction || !template.available_from_time || !template.available_to_time) {
    return new Date(Date.UTC(refPht.getUTCFullYear(), refPht.getUTCMonth(), refPht.getUTCDate()) - PHT_OFFSET_MS);
  }
  const [fh, fm] = template.available_from_time.split(':').map(Number);
  const [th, tm] = template.available_to_time.split(':').map(Number);
  const fromMinutes = fh * 60 + fm;
  const toMinutes = th * 60 + tm;
  const refMinutes = refPht.getUTCHours() * 60 + refPht.getUTCMinutes();
  const todayFromUtcMs = Date.UTC(refPht.getUTCFullYear(), refPht.getUTCMonth(), refPht.getUTCDate(), 0, fromMinutes, 0) - PHT_OFFSET_MS;
  if (fromMinutes <= toMinutes) return new Date(todayFromUtcMs);
  return refMinutes >= fromMinutes ? new Date(todayFromUtcMs) : new Date(todayFromUtcMs - 24 * 60 * 60 * 1000);
}

// Extract the item labels listed under "Items marked NO:" in an auto-ticket's
// description. Used to detect which items already have an active (non-closed) ticket
// for a store, so a recurring NO doesn't spawn a duplicate until the prior ticket is closed.
function extractCoveredItemLabels(description) {
  const labels = new Set();
  if (!description) return labels;
  const marker = description.indexOf('Items marked NO:');
  if (marker === -1) return labels;
  const rest = description.slice(marker + 'Items marked NO:'.length);
  for (const raw of rest.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('• ')) continue;
    const body = line.slice(2);
    const label = body.split(' — ')[0].trim();
    if (label) labels.add(label);
  }
  return labels;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Auth is optional — entity automations invoke this with no user session.
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json();

    // Resolve the audit submission from either an entity-automation payload
    // ({ event: { entity_id }, data }) or a direct invocation ({ submission } / { submission_id }).
    let submission = body?.data || null;
    let submissionId = body?.event?.entity_id || body?.submission_id || body?.submission?.id || null;

    if (!submission && submissionId) {
      try {
        submission = await base44.asServiceRole.entities.AuditSubmission.get(submissionId);
      } catch (_e) {
        return Response.json({ skipped: true, reason: 'submission not found' });
      }
    } else if (!submission && body?.submission) {
      submission = body.submission;
    }

    if (!submission || !submission.template_id) {
      return Response.json({ skipped: true, reason: 'no submission data' });
    }

    // Only react to create events when triggered by an entity automation
    if (body?.event?.type && body.event.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not a create event' });
    }

    // Source of truth: the template must be tagged "active ticket"
    let template = null;
    try {
      template = await base44.asServiceRole.entities.AuditTemplate.get(submission.template_id);
    } catch (_e) {
      return Response.json({ skipped: true, reason: 'template not found' });
    }
    // Enforce ONE audit submission per store per template per cycle.
    // Draft restores / double-submits / lost-response retries can create duplicates,
    // so the server removes the later submission when an earlier one already exists
    // in the same cycle. Only runs for real entity-automation create events.
    if (body?.event?.type === 'create' && submission.brand && submission.created_date) {
      const myId = submission.id || submissionId;
      const cycleStart = getCycleStartUtc(template, submission.created_date);
      if (cycleStart && myId) {
        const sameStoreTemplate = await base44.asServiceRole.entities.AuditSubmission.filter({
          template_id: submission.template_id,
          brand: submission.brand,
        }, 'created_date', 50).catch(() => []);
        const myCreated = parseDateUtc(submission.created_date).getTime();
        const earlierInCycle = sameStoreTemplate.filter((s) => {
          if (s.id === myId) return false;
          const c = parseDateUtc(s.created_date);
          if (!c) return false;
          const t = c.getTime();
          return t >= cycleStart.getTime() && t <= myCreated;
        });
        if (earlierInCycle.length > 0) {
          try {
            await base44.asServiceRole.entities.AuditSubmission.delete(myId);
          } catch (_e) {}
          return Response.json({
            deduped: true,
            deleted_duplicate: myId,
            kept_earliest: earlierInCycle[0].id,
          });
        }
      }
    }

    if (!template || !template.active_ticket) {
      return Response.json({ skipped: true, reason: 'template not active-ticket tagged' });
    }

    // Only create tickets when there is at least one NO answer
    const answers = submission.answers || {};
    const hasNo = Object.values(answers).some((a) => a === 'NO');
    if (!hasNo) {
      return Response.json({ skipped: true, reason: 'no NO answers — YES/NA only' });
    }

    // --- Create one separate ticket PER SECTION that has at least one NO answer ---
    // Each section's title (e.g. "MIS", "BMD") maps to a Department. That department
    // becomes the ticket's department AND handling department, so the ticket is
    // assigned to that department's head after approval. Two sections with NO ->
    // two separate tickets.
    const categories = await base44.asServiceRole.entities.Category.filter({ is_active: true });
    const departments = await base44.asServiceRole.entities.Department.filter({ is_active: true });
    const allUsers = await base44.asServiceRole.entities.User.list();

    // Approval routing — same process as manual ticket creation.
    const submitter = allUsers.find((u) => u.email === submission.submitted_by_email);
    const submitterDeptId = submitter?.department_id || '';
    const approver = allUsers.find(
      (u) => u.user_type === 'approver' && u.department_id === submitterDeptId
    );

    const storeLabel = submission.brand || '—';
    // Use the submitter's short store_name (matches store-managers' assigned_stores)
    // so store managers actually see the ticket for approval.
    const storeNameForRouting = submitter?.store_name || submission.brand || '';

    // Dedupe: collect item labels that already have an ACTIVE (non-closed) auto-ticket
    // for this store. A recurring NO for the same item won't create a duplicate until
    // the prior ticket is closed/resolved.
    const existingTickets = storeNameForRouting
      ? await base44.asServiceRole.entities.Ticket.filter({ store_name: storeNameForRouting }, '-created_date', 200).catch(() => [])
      : await base44.asServiceRole.entities.Ticket.list('-created_date', 200).catch(() => []);
    const coveredItemLabels = new Set();
    for (const t of existingTickets) {
      if (!t || t.status === 'resolved' || t.status === 'closed') continue;
      if (!t.title || !t.title.startsWith('Audit NO —')) continue;
      for (const label of extractCoveredItemLabels(t.description)) {
        coveredItemLabels.add(label);
      }
    }

    // Sections that contain at least one NO answer
    const sectionsWithNo = (template.sections || []).filter((sec) =>
      (sec.items || []).some((item) => answers[item.id] === 'NO')
    );

    if (sectionsWithNo.length === 0) {
      return Response.json({ skipped: true, reason: 'no NO answers — YES/NA only' });
    }

    const createdTickets = [];
    for (const sec of sectionsWithNo) {
      // Map the section title to a department (e.g. "MIS" -> MIS department)
      let dept = departments.find((d) => d.name === sec.title);

      // Category: prefer "<Section> Concerns" (e.g. "MIS Concerns"), then a category
      // named exactly like the section, then fall back to the template-title category.
      const cat =
        categories.find((c) => c.name === `${sec.title} Concerns`) ||
        categories.find((c) => c.name === sec.title) ||
        categories.find((c) => c.name === template.title) ||
        null;

      // If the section title didn't match a department, fall back to the category's department.
      if (!dept && cat?.department_id) {
        dept = departments.find((d) => d.id === cat.department_id);
      }

      const handlingDeptId = dept?.id || cat?.department_id || '';
      const handlingDeptName = dept?.name || cat?.department_name || '';
      if (!handlingDeptId) {
        // No routable department for this section — skip it (other sections may still create tickets)
        continue;
      }

      // NO items in THIS section only — skip any item that already has an ACTIVE
      // (non-closed) auto-ticket for this store, so a recurring NO doesn't spawn a
      // duplicate until the prior ticket is closed/resolved.
      const noLines = [];
      const sectionPhotos = [];
      for (const item of (sec.items || [])) {
        if (answers[item.id] === 'NO' && !coveredItemLabels.has(item.label)) {
          const comment = submission.no_comments?.[item.id] || '';
          noLines.push(`• ${item.label}${comment ? ` — ${comment}` : ''}`);
          const photos = submission.item_photos?.[item.id];
          if (Array.isArray(photos)) sectionPhotos.push(...photos);
        }
      }
      // All NO items in this section already have active tickets — nothing new to create
      if (noLines.length === 0) {
        continue;
      }

      const title = `Audit NO — ${sec.title} (${storeLabel})`;
      const description = [
        'Auto-generated ticket from audit submission.',
        '',
        `Store: ${storeLabel}`,
        `Submitted by: ${submission.submitted_by_name || submission.submitted_by_email || '—'}`,
        `Section: ${sec.title}`,
        '',
        'Items marked NO:',
        noLines.join('\n'),
      ]
        .filter(Boolean)
        .join('\n');

      const ticket = await base44.asServiceRole.entities.Ticket.create({
        title,
        description,
        // The section's department — shown as the ticket department and assigned to its head after approval
        department_id: handlingDeptId,
        department_name: handlingDeptName,
        category_id: cat?.id || '',
        category_name: cat?.name || sec.title,
        handling_department_id: handlingDeptId,
        handling_department_name: handlingDeptName,
        priority: 'high',
        submitter_email: submission.submitted_by_email || (user?.email || ''),
        submitter_name: submission.submitted_by_name || (user?.full_name || ''),
        store_name: storeNameForRouting,
        image_urls: sectionPhotos,
        // Forward to approval first (same process as manual tickets)
        status: 'pending_approval',
        approval_status: 'pending',
        approver_email: approver?.email || '',
        approver_name: approver?.full_name || '',
      });

      // Apply the same automation rules as manual ticket creation (best-effort)
      try {
        await base44.asServiceRole.functions.invoke('applyTicketRules', { ticket_id: ticket.id });
      } catch (_e) {
        // rules engine failure should not fail ticket creation
      }

      createdTickets.push({
        ticket_id: ticket.id,
        section: sec.title,
        department: handlingDeptName,
        category: cat?.name || sec.title,
      });
    }

    return Response.json({
      created: createdTickets.length > 0,
      pending_approval: createdTickets.length > 0,
      tickets: createdTickets,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});