import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Camera, RefreshCw, Check, X, MapPin } from "lucide-react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [location, setLocation] = useState(null);

  const fetchLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const a = data?.address || {};
          const place = [a.suburb, a.city || a.town || a.municipality, a.state, a.country]
            .filter(Boolean).slice(0, 3).join(', ');
          setLocation(place || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      () => setLocation(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const startCamera = async (mode = facingMode) => {
    setError('');
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
    } catch (e) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera permissions in your browser.'
          : e?.name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : 'Unable to access the camera: ' + (e?.message || 'unknown error')
      );
      setStreaming(false);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    fetchLocation();
    return stopStream;
     
  }, []);

  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Burn a timestamp + location into the photo (Manila time)
    const stamp = new Date().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const lineTwo = location || 'Locating...';
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

    setSnapshot(canvas.toDataURL('image/jpeg', 0.92));
  };

  const handleRetake = () => setSnapshot(null);

  const handleConfirm = async () => {
    if (!snapshot) return;
    setUploading(true);
    try {
      const blob = await (await fetch(snapshot)).blob();
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopStream();
      await onCapture(file);
    } catch (e) {
      setError('Failed to capture photo: ' + (e?.message || 'unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    stopStream();
    onClose?.();
  };

  const handleFlip = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="font-bold text-slate-800 flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#1fd655]" /> Take Photo
          </p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} disabled={uploading}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative bg-black aspect-video flex items-center justify-center">
          {!snapshot ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="max-h-full max-w-full object-contain"
              />
              {streaming && !error && (
                <button
                  onClick={handleSnap}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-slate-300 hover:border-[#1fd655] transition-colors flex items-center justify-center shadow-lg"
                  aria-label="Capture photo"
                >
                  <Camera className="w-7 h-7 text-slate-700" />
                </button>
              )}
              {streaming && !error && (
                <button
                  onClick={handleFlip}
                  className="absolute bottom-5 right-4 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow"
                  aria-label="Switch camera"
                  title="Switch camera"
                >
                  <RefreshCw className="w-4 h-4 text-slate-700" />
                </button>
              )}
              {!snapshot && (
                <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/55 text-white text-xs flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {location || 'Locating...'}
                </div>
              )}
            </>
          ) : (
            <img src={snapshot} alt="Preview" className="max-h-full max-w-full object-contain" />
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <p className="text-white text-sm">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => startCamera()}>Retry</Button>
            </div>
          )}
          {!streaming && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-white/70" />
            </div>
          )}
        </div>

        {snapshot && (
          <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-200">
            <Button variant="outline" onClick={handleRetake} disabled={uploading}>Retake</Button>
            <Button
              onClick={handleConfirm}
              disabled={uploading}
              className="bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-semibold gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Use Photo
            </Button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}