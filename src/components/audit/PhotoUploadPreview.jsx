import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, MapPin, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { getLocation } from '@/lib/getLocation';
import { getServerTime } from '@/lib/serverTime';
import { hashFile } from '@/lib/fileHash';
import { supabase } from '@/api/supabaseClient';

// Shown after picking photo(s) from the device gallery/file picker. Mirrors
// CameraCapture's location-gating: the confirm/upload action stays disabled
// until GPS resolves, and the same timestamp + location stamp gets burned
// into each photo before it's handed off to the caller's upload function.
// Also blocks re-using the exact same photo file across different days for
// the same checklist item/store, since that's easy to do from a gallery
// (unlike a live camera capture, which is always a genuinely new file).
export default function PhotoUploadPreview({ files, storeName, templateId, itemKey, onDone, onClose }) {
  const canvasRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [location, setLocation] = useState(null);
  const [locatingGps, setLocatingGps] = useState(true);
  const [locationFailed, setLocationFailed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stamped, setStamped] = useState([]);
  const [serverTime, setServerTime] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const currentHashRef = useRef(null);

  const fileList = Array.isArray(files) ? files : Array.from(files || []);
  const currentFile = fileList[index];

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
    fetchLocation();
    getServerTime().then(setServerTime);
  }, []);

  useEffect(() => {
    if (!currentFile) return;
    const url = URL.createObjectURL(currentFile);
    setPreviewUrl(url);

    setDuplicateDetected(false);
    currentHashRef.current = null;
    if (storeName && templateId && itemKey) {
      setCheckingDuplicate(true);
      (async () => {
        try {
          const hash = await hashFile(currentFile);
          currentHashRef.current = hash;
          const { data, error } = await supabase
            .from('photo_upload_hashes')
            .select('id')
            .eq('store_name', storeName)
            .eq('template_id', templateId)
            .eq('item_key', itemKey)
            .eq('file_hash', hash)
            .limit(1);
          if (error) throw error;
          setDuplicateDetected((data || []).length > 0);
        } catch (e) {
          console.warn('Duplicate-photo check failed, allowing upload:', e);
        } finally {
          setCheckingDuplicate(false);
        }
      })();
    }

    return () => URL.revokeObjectURL(url);
  }, [currentFile, storeName, templateId, itemKey]);

  const loadImage = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const recordHash = async (hash) => {
    if (!hash || !storeName || !templateId || !itemKey) return;
    try {
      await supabase.from('photo_upload_hashes').insert({
        store_name: storeName,
        template_id: templateId,
        item_key: itemKey,
        file_hash: hash,
      });
    } catch (e) {
      console.warn('Failed to record photo hash:', e);
    }
  };

  const stampAndAdvance = async () => {
    if (!currentFile || duplicateDetected || checkingDuplicate) return;
    setProcessing(true);
    try {
      const img = await loadImage(currentFile);
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Burn a timestamp + location into the photo (Manila time) — uses the
      // server's clock, not the device's, so it can't be spoofed by
      // changing the phone/laptop's date and time.
      const stamp = (serverTime || new Date()).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
      const lineTwo = location || 'Location unavailable';
      const fontPx = Math.max(16, Math.round(canvas.height * 0.035));
      ctx.font = `${fontPx}px sans-serif`;
      const padX = Math.round(fontPx * 0.4);
      const padY = Math.round(fontPx * 0.3);
      const lineHeight = Math.round(fontPx * 1.25);
      const textW = Math.max(ctx.measureText(stamp).width, ctx.measureText(lineTwo).width);
      const boxH = lineHeight * 2 + padY * 2;
      const boxY = canvas.height - boxH - Math.round(canvas.height * 0.02);
      const boxX = Math.round(canvas.height * 0.02);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(boxX, boxY, textW + padX * 2, boxH);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(stamp, boxX + padX, boxY + padY + lineHeight / 2);
      ctx.fillText(lineTwo, boxX + padX, boxY + padY + lineHeight * 1.5);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const blob = await (await fetch(dataUrl)).blob();
      const stampedFile = new File([blob], `photo_${Date.now()}_${index}.jpg`, { type: 'image/jpeg' });

      await recordHash(currentHashRef.current);

      const next = [...stamped, stampedFile];
      if (index + 1 < fileList.length) {
        setStamped(next);
        setIndex(index + 1);
      } else {
        onDone(next);
      }
    } catch (e) {
      console.error('Failed to stamp photo:', e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="flex items-center gap-2 font-bold text-slate-800">
            <ImageIcon className="h-4 w-4 text-[#1fd655]" />
            Confirm Photo {fileList.length > 1 ? `(${index + 1} of ${fileList.length})` : ''}
          </p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={processing}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black sm:aspect-video sm:flex-none">
          {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />}
          <div className="absolute top-3 left-3 rounded bg-black/55 px-2 py-1 text-xs text-white">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {locationFailed ? (
                <>
                  <span>Activate Location / Check Internet</span>
                  <button type="button" onClick={() => fetchLocation()} className="ml-1 underline decoration-white/60 underline-offset-2 hover:decoration-white">
                    Retry
                  </button>
                </>
              ) : (
                location || 'Locating...'
              )}
            </div>
            <div className="mt-0.5 pl-5">
              {(serverTime || new Date()).toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: true,
              })}
            </div>
          </div>
        </div>

        {duplicateDetected && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This exact photo has already been used for this checklist item before. Please choose or take a current photo instead.</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
          <Button variant="outline" onClick={onClose} disabled={processing}>Cancel</Button>
          <Button
            onClick={stampAndAdvance}
            disabled={processing || locatingGps || locationFailed || checkingDuplicate || duplicateDetected}
            className="gap-2 bg-[#1fd655] font-semibold text-slate-900 hover:bg-[#1bd64d]"
          >
            {processing || locatingGps || checkingDuplicate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {fileList.length > 1 && index + 1 < fileList.length ? 'Confirm & Next' : 'Use Photo'}
          </Button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}