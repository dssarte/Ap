import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, MapPin, Clock, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { getLocation } from '@/lib/getLocation';
import { getServerTime } from '@/lib/serverTime';
import { hashFile } from '@/lib/fileHash';
import { supabase } from '@/api/supabaseClient';

// Shown after picking photo(s) from the device gallery/file picker — every
// picked photo on one screen, confirmed with a single tap instead of one
// confirmation per photo. With stamp on it mirrors CameraCapture's
// location-gating: the upload stays disabled until GPS resolves, and the
// same timestamp + location stamp gets burned into each photo before it's
// handed off to the caller's upload function. With stamp off (QA
// checklists) there's no GPS and photos go through untouched.
// Also skips re-using the exact same photo file across different days for
// the same checklist item/store, since that's easy to do from a gallery
// (unlike a live camera capture, which is always a genuinely new file).
export default function PhotoUploadPreview({ files, storeName, templateId, itemKey, onDone, onClose, stamp = true }) {
  const fileList = useMemo(() => (Array.isArray(files) ? files : Array.from(files || [])), [files]);
  const canCheckDuplicates = !!(storeName && templateId && itemKey);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [removed, setRemoved] = useState(() => new Set());
  const [hashes, setHashes] = useState([]);
  const [duplicates, setDuplicates] = useState(() => new Set());
  const [checkingDuplicates, setCheckingDuplicates] = useState(canCheckDuplicates);
  const [location, setLocation] = useState(null);
  const [locatingGps, setLocatingGps] = useState(stamp);
  const [locationFailed, setLocationFailed] = useState(false);
  const [serverTime, setServerTime] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const fetchLocation = async (attempt = 1) => {
    setLocatingGps(true);
    setLocationFailed(false);
    const place = await getLocation();
    if (place) {
      setLocation(place);
      setLocatingGps(false);
      return;
    }
    if (attempt < 3) {
      fetchLocation(attempt + 1);
      return;
    }
    setLocatingGps(false);
    setLocationFailed(true);
  };

  useEffect(() => {
    if (!stamp) return;
    fetchLocation();
    getServerTime().then(setServerTime);
  }, []);

  useEffect(() => {
    const urls = fileList.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [fileList]);

  // Hash every picked photo, then look them all up together. One already
  // recorded for this store + checklist item — or picked twice in this same
  // batch — is marked and left out of the upload.
  useEffect(() => {
    if (!canCheckDuplicates) return undefined;
    let cancelled = false;
    (async () => {
      try {
        // A few at a time — reading 100+ full-size photos into memory at
        // once can run a phone browser out of memory.
        const fileHashes = [];
        for (let i = 0; i < fileList.length; i += 4) {
          fileHashes.push(...await Promise.all(fileList.slice(i, i + 4).map(hashFile)));
        }
        if (cancelled) return;
        // Kept even if the lookup below fails, so the upload still gets recorded.
        setHashes(fileHashes);
        const unique = [...new Set(fileHashes)];
        const used = new Set();
        // Chunked so each lookup URL stays short.
        for (let i = 0; i < unique.length; i += 50) {
          const { data, error: lookupError } = await supabase
            .from('photo_upload_hashes')
            .select('file_hash')
            .eq('store_name', storeName)
            .eq('template_id', templateId)
            .eq('item_key', itemKey)
            .in('file_hash', unique.slice(i, i + 50));
          if (lookupError) throw lookupError;
          (data || []).forEach(row => used.add(row.file_hash));
        }
        if (cancelled) return;
        const seen = new Set();
        const flagged = new Set();
        fileHashes.forEach((hash, index) => {
          if (used.has(hash) || seen.has(hash)) flagged.add(index);
          seen.add(hash);
        });
        setDuplicates(flagged);
      } catch (e) {
        console.warn('Duplicate-photo check failed, allowing upload:', e);
      } finally {
        if (!cancelled) setCheckingDuplicates(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileList, canCheckDuplicates, storeName, templateId, itemKey]);

  const selectedIndexes = fileList.map((_, index) => index).filter(index => !removed.has(index) && !duplicates.has(index));
  const duplicateCount = [...duplicates].filter(index => !removed.has(index)).length;
  const single = fileList.length === 1;

  const stampTime = (serverTime || new Date()).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  // Burn a timestamp + location into the photo (Manila time) — uses the
  // server's clock, not the device's, so it can't be spoofed by changing
  // the phone/laptop's date and time.
  const stampPhoto = async (file, index) => {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const lines = [stampTime, location || 'Location unavailable'];
      const fontPx = Math.max(16, Math.round(canvas.height * 0.035));
      ctx.font = `${fontPx}px sans-serif`;
      const padX = Math.round(fontPx * 0.4);
      const padY = Math.round(fontPx * 0.3);
      const lineHeight = Math.round(fontPx * 1.25);
      const textW = Math.max(...lines.map(line => ctx.measureText(line).width));
      const boxH = lineHeight * lines.length + padY * 2;
      const boxY = canvas.height - boxH - Math.round(canvas.height * 0.02);
      const boxX = Math.round(canvas.height * 0.02);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(boxX, boxY, textW + padX * 2, boxH);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => ctx.fillText(line, boxX + padX, boxY + padY + lineHeight * (i + 0.5)));

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not process this photo.');
      return new File([blob], `photo_${Date.now()}_${index}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleConfirm = async () => {
    if (selectedIndexes.length === 0) return;
    setProcessing(true);
    setError('');
    try {
      // One at a time — each stamp draws a full-size photo onto a canvas.
      const ready = [];
      for (const index of selectedIndexes) {
        ready.push(stamp ? await stampPhoto(fileList[index], index) : fileList[index]);
      }

      const hashRows = selectedIndexes
        .map(index => hashes[index])
        .filter(Boolean)
        .map(file_hash => ({ store_name: storeName, template_id: templateId, item_key: itemKey, file_hash }));
      if (hashRows.length > 0) {
        const { error: recordError } = await supabase.from('photo_upload_hashes').insert(hashRows);
        if (recordError) console.warn('Failed to record photo hashes:', recordError);
      }

      onDone(ready);
    } catch (e) {
      console.error('Failed to prepare photos:', e);
      setError('Some photos could not be processed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = (index) => setRemoved(prev => new Set(prev).add(index));

  const waiting = checkingDuplicates || locatingGps;
  const confirmLabel = checkingDuplicates
    ? 'Checking photos...'
    : locatingGps
      ? 'Getting location...'
      : selectedIndexes.length > 1
        ? `Use ${selectedIndexes.length} Photos`
        : single || selectedIndexes.length === 1 ? 'Use Photo' : 'No photos selected';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="flex items-center gap-2 font-bold text-slate-800">
            <ImageIcon className="h-4 w-4 text-[#1fd655]" />
            {single ? 'Confirm Photo' : `Confirm Photos (${fileList.length})`}
          </p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={processing}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {stamp && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {locationFailed ? (
                <>
                  <span>Activate Location / Check Internet</span>
                  <button type="button" onClick={() => fetchLocation()} className="ml-1 font-semibold underline underline-offset-2">
                    Retry
                  </button>
                </>
              ) : (
                location || 'Locating...'
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {stampTime}
            </span>
          </div>
        )}

        {single ? (
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black sm:aspect-video sm:flex-none">
            {previewUrls[0] && <img src={previewUrls[0]} alt="Preview" className="max-h-full max-w-full object-contain" />}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3 sm:max-h-[60vh] sm:flex-none">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fileList.map((file, index) => {
                if (removed.has(index)) return null;
                const isDuplicate = duplicates.has(index);
                return (
                  <div key={index} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                    {previewUrls[index] && (
                      <img
                        src={previewUrls[index]}
                        alt={`Photo ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full object-cover ${isDuplicate ? 'opacity-40' : ''}`}
                      />
                    )}
                    {isDuplicate && (
                      <span className="absolute inset-x-1 bottom-1 rounded bg-amber-500 px-1 py-0.5 text-center text-[10px] font-bold text-white">
                        Duplicate
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      disabled={processing}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {duplicateCount > 0 && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {single
                ? 'This exact photo has already been used for this checklist item before. Please choose or take a current photo instead.'
                : `${duplicateCount} duplicate photo${duplicateCount === 1 ? '' : 's'} will be skipped — the same photo was already used for this checklist item, or picked twice.`}
            </span>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
          <span className="text-xs text-slate-500">
            {!single && `${selectedIndexes.length} of ${fileList.length} selected`}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={processing}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={processing || waiting || locationFailed || selectedIndexes.length === 0}
              className="gap-2 bg-[#1fd655] font-semibold text-slate-900 hover:bg-[#1bd64d]"
            >
              {processing || waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
