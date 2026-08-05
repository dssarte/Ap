import React, { useState } from 'react';
import { ImageOff, X } from 'lucide-react';

const isHeic = (url = '') => /\.heic($|\?)/i.test(url);

// Renders an image thumbnail. HEIC files (from iPhones) can't be displayed in
// most browsers, so we show a placeholder instead of a broken image icon.
// Clicking a valid thumbnail opens it full-size in a lightbox overlay.
export default function PhotoThumb({ url, alt, className = '', placeholderClassName = '' }) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);

  if (isHeic(url) || broken) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-slate-100 border border-slate-200 rounded-md text-slate-400`}>
        <ImageOff className="w-5 h-5 mb-1" />
        <span className="text-[9px] font-medium leading-tight text-center px-1">
          {isHeic(url) ? 'HEIC' : 'N/A'}
        </span>
      </div>
    );
  }

  return (
    <>
      <img
        src={url}
        alt={alt}
        className={`${className} cursor-zoom-in`}
        onClick={() => setOpen(true)}
        onError={() => setBroken(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={url}
            alt={alt}
            className="max-h-[95vh] max-w-[95vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}