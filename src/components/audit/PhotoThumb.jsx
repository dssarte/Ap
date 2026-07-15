import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

const isHeic = (url = '') => /\.heic($|\?)/i.test(url);

// Renders an image thumbnail. HEIC files (from iPhones) can't be displayed in
// most browsers, so we show a placeholder instead of a broken image icon.
export default function PhotoThumb({ url, alt, className = '', placeholderClassName = '' }) {
  const [broken, setBroken] = useState(false);

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
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}