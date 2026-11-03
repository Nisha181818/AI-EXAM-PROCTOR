import { useEffect, useRef } from 'react';
import { apiClient } from '../api/client';

export interface UseLockdownProps {
  attemptId: number;
  onViolation?: (type: string, severity: 'soft' | 'hard', description: string) => void;
  enabled?: boolean;
}

export const useLockdown = ({ attemptId, onViolation, enabled = true }: UseLockdownProps) => {
  const attemptIdRef = useRef(attemptId);
  attemptIdRef.current = attemptId;

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const lastLogTimeRef = useRef<Record<string, number>>({});

  const logViolation = async (eventType: string, severity: 'soft' | 'hard', description: string, evidenceBase64?: string) => {
    if (!enabled) return;

    // Throttle duplicate violation logs (at most once every 3 seconds per event type)
    const now = Date.now();
    const lastTime = lastLogTimeRef.current[eventType] || 0;
    if (now - lastTime < 3000) {
      if (onViolationRef.current) {
        onViolationRef.current(eventType, severity, description);
      }
      return;
    }
    lastLogTimeRef.current[eventType] = now;

    try {
      if (onViolationRef.current) {
        onViolationRef.current(eventType, severity, description);
      }
      await apiClient.post('/monitoring/events', {
        attempt_id: attemptIdRef.current,
        event_type: eventType,
        severity,
        description,
        evidence_base64: evidenceBase64,
      });
    } catch (err) {
      console.error('Failed to log exam event', err);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // 1. Strictly block contextmenu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      logViolation('right_click_attempt', 'soft', 'Right-click context menu is strictly disabled during the exam');
      return false;
    };

    // 2. Strictly block Copy, Paste, Cut
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.clipboardData) {
        e.clipboardData.clearData();
      }
      logViolation('copy_attempt', 'soft', 'Copying content is disabled during the exam');
      return false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      logViolation('paste_attempt', 'soft', 'Pasting external content is prohibited during the exam');
      return false;
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      logViolation('cut_attempt', 'soft', 'Cutting content is disabled during the exam');
      return false;
    };

    // 3. Block keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+U, F12, DevTools)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U (view source), Ctrl+S (save), Ctrl+P (print)
      if (isCtrlOrMeta && ['c', 'v', 'x', 'u', 's', 'p'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        const action = key === 'c' ? 'Copy' : key === 'v' ? 'Paste' : key === 'x' ? 'Cut' : 'Shortcut';
        logViolation('clipboard_attempt', 'soft', `${action} (Ctrl+${key.toUpperCase()}) is disabled`);
        return false;
      }

      // Block F12 and DevTools shortcuts (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (e.key === 'F12' || (isCtrlOrMeta && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
        e.preventDefault();
        e.stopPropagation();
        logViolation('devtools_attempt', 'hard', 'Developer inspection tools are strictly prohibited');
        return false;
      }
    };

    // 4. Tab switch / window blur via Page Visibility API
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'hard', 'Exam window lost focus or tab switched');
      }
    };

    const handleWindowBlur = () => {
      logViolation('window_blur', 'soft', 'Exam browser window lost active focus');
    };

    // 5. Fullscreen change detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation('fullscreen_exit', 'hard', 'Fullscreen mode was exited');
      }
    };

    // Use capture phase (true) so listeners trigger BEFORE elements or Monaco consume events
    window.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    window.addEventListener('copy', handleCopy, true);
    document.addEventListener('copy', handleCopy, true);

    window.addEventListener('paste', handlePaste, true);
    document.addEventListener('paste', handlePaste, true);

    window.addEventListener('cut', handleCut, true);
    document.addEventListener('cut', handleCut, true);

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);

      window.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('copy', handleCopy, true);

      window.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('paste', handlePaste, true);

      window.removeEventListener('cut', handleCut, true);
      document.removeEventListener('cut', handleCut, true);

      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enabled]);

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Could not enter fullscreen:', err);
    }
  };

  return { enterFullscreen, logViolation };
};
