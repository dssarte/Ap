import { supabase } from '@/api/supabaseClient';

// Returns the database server's current time, not the device's local clock —
// closes the gap where someone could change their phone/laptop's date and
// time to make a photo's burned-in stamp show a fake date. Falls back to
// device time (with a warning) only if the server call itself fails, so a
// network hiccup can't block someone from completing an audit.
export async function getServerTime() {
  try {
    const { data, error } = await supabase.rpc('get_server_time');
    if (error) throw error;
    return new Date(data);
  } catch (e) {
    console.warn('Falling back to device time for photo stamp — server time unavailable:', e);
    return new Date();
  }
}