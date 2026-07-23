export function getUserDisplayName(user, fallback = 'Account') {
  const displayName = String(user?.display_name || '').trim();
  if (displayName) return displayName;

  const fullName = String(user?.full_name || '').trim();
  if (fullName) return fullName;

  const email = String(user?.email || '').trim();
  return email || fallback;
}
