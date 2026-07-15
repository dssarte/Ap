// Downscale + re-encode an image file to a small JPEG before upload.
// Phone photos are often 3-5MB; this brings them to ~100-300KB with no visible loss
// for audit/evidence purposes. Smaller uploads = less storage and faster saves.
//
// Falls back to the original file if the browser can't decode it (e.g. HEIC).

const MAX_DIMENSION = 1280; // longest edge in px
const JPEG_QUALITY = 0.7;

export async function compressImage(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;

  // Already small enough — skip the canvas round-trip.
  if (file.size <= 250 * 1024) return file;

  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    let { width, height } = img;
    if (width > height && width > maxDimension) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else if (height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.(png|jpg|jpeg|heic)$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    // Canvas can't decode this format — upload the original untouched.
    return file;
  }
}