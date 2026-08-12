// SHA-256 hash of a file's raw bytes — used to detect if someone re-uploads
// the exact same photo file they used on a previous day. Only catches an
// identical file being reused (which is the actual failure mode reported);
// a genuinely new photo, even of the same equipment, will always hash
// differently.
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}