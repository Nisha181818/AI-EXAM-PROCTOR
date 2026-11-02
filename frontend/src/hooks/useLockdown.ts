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

  const logViolation = async (eventType: string, severity: 'soft' | 'hard', description: string, evidenceBase64?: string) => {
    if (!enabled) return;
    try {
      await apiClient.post('/monitoring/events', {
        attempt_id: attemptIdRef.current,
        event_type: eventType,
        severity,
        description,
        evidence_base64: evidenceBase64,
      });
      if (onViolation) {
        onViolation(eventType, severity, description);
      }
    } catch (err) {
      console.error('Failed to log exam event', err);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // 1. Prevent contextmenu (right-click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('right_click_attempt', 'soft', 'Student attempted to open context menu (right click)');
    };

    // 2. Prevent copy / paste / cut
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('copy_attempt', 'soft', 'Student attempted to copy content');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('paste_attempt', 'soft', 'Student attempted to paste content');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('cut_attempt', 'soft', 'Student attempted to cut content');
    };

    // 3. Tab switch / window blur via Page Visibility API
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'hard', 'Student switched tabs or minimized exam window');
      }
    };

    const handleWindowBlur = () => {
      logViolation('window_blur', 'soft', 'Exam window lost active focus');
    };

    // 4. Fullscreen change detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation('fullscreen_exit', 'hard', 'Student exited fullscreen mode');
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
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
