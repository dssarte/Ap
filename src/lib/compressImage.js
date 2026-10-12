// Downscale + re-encode an image file to a small JPEG before upload.
// Phone photos are often 3-5MB; this brings them to roughly 60-120KB.
// 1024px keeps handwriting and small print (temperature logs, labels,
// receipts, POS books) readable when zoomed, while storing about a third
// less than the previous 1280px — photo storage is billed per GB, and audit
// photos are kept for years. Going much lower makes text in evidence photos
// hard to read.
//
// Falls back to the original file if the browser can't decode it (e.g. HEIC).

const MAX_DIMENSION = 1024; // longest edge in px
const JPEG_QUALITY = 0.7;

export async function compressImage(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;

  // Already about the size a resized photo would be — skip the canvas
  // round-trip. Kept low so in-app camera captures (often 150-250KB at
  // 1280px) still get resized instead of being uploaded as-is.
  if (file.size <= 120 * 1024) return file;

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