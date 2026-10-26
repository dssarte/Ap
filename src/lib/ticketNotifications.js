import { supabase } from '@/api/supabaseClient';

// Marks this user's unread notifications for the given ticket(s) as read, in
// one update targeted by ticket — not by scanning their notifications first:
// busy accounts pile up thousands, and a capped scan could miss a ticket's
// rows, so its red dot cleared on screen but came back on the next refresh.
export async function markTicketNotificationsRead(userEmail, ticketIds) {
  const ids = (ticketIds || []).filter(Boolean);
  if (!userEmail || ids.length === 0) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, updated_date: new Date().toISOString() })
    .eq('user_email', userEmail)
    .in('ticket_id', ids)
    .eq('is_read', false);
  if (error) throw error;
}
