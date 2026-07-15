import { useCallback, useEffect, useRef } from 'react';

// Persists an audit form snapshot to localStorage keyed by template + user (+ edit id).
// Returns load/save/clear helpers. The component is responsible for calling save with
// the current form snapshot (debounced internally) and clear on successful submit.
export function useDraftStorage(draftKey) {
  const saveDraft = useCallback((data) => {
    try {
      const payload = { ...data, _savedAt: Date.now() };
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (e) {
      // storage full / unavailable — silently ignore; drafts are best-effort
    }
  }, [draftKey]);

  const loadDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch (e) {
      // ignore
    }
  }, [draftKey]);

  return { saveDraft, loadDraft, clearDraft };
}

// Debounced autosave: pass a snapshot and a key; saves ~1s after the last change.
export function useAutosaveDraft(draftKey, snapshot, enabled = true) {
  const { saveDraft, clearDraft } = useDraftStorage(draftKey);
  const timer = useRef(null);

  useEffect(() => {
    if (!enabled || !draftKey) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDraft(snapshot);
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draftKey, snapshot, enabled, saveDraft]);

  return { saveDraft, clearDraft };
}