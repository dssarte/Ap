// Captures the device location and reverse-geocodes it to a readable address.
// Returns a string (address or coordinates), or null if unavailable/timeout.
export async function getLocation() {
  if (!navigator?.geolocation) return null;
  const coords = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
  if (!coords) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=14&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data?.address || {};
    const place = [a.suburb, a.city || a.town || a.municipality, a.state, a.country]
      .filter(Boolean).slice(0, 3).join(', ');
    return place || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  } catch {
    return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }
}