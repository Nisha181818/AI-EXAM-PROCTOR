import { useEffect, useRef, useState } from 'react';

export interface MediaPipeMetrics {
  faceCount: number;
  isLookingAway: boolean;
  yawAngle: number;
  landmarksDetected: boolean;
  statusMessage?: string;
}

export const useMediaPipe = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onViolation?: (type: string, severity: 'soft' | 'hard', desc: string) => void,
  active: boolean = true
) => {
  const [metrics, setMetrics] = useState<MediaPipeMetrics>({
    faceCount: 1, // Start optimistic while camera warms up
    isLookingAway: false,
    yawAngle: 0,
    landmarksDetected: false,
  });

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const missingFramesRef = useRef(0);
  const multipleFramesRef = useRef(0);
  const lookAwayTimerRef = useRef<number | null>(null);
  const lastViolationLogTimeRef = useRef<Record<string, number>>({});
  const faceMeshRef = useRef<any>(null);

  // Helper to rate-limit violation calls to backend
  const triggerViolation = (type: string, severity: 'soft' | 'hard', desc: string, minIntervalMs: number = 12000) => {
    const now = Date.now();
    const last = lastViolationLogTimeRef.current[type] || 0;
    if (now - last >= minIntervalMs) {
      lastViolationLogTimeRef.current[type] = now;
      if (onViolationRef.current) {
        onViolationRef.current(type, severity, desc);
      }
    }
  };

  useEffect(() => {
    if (!active) return;

    let isMounted = true;
    let checkInterval: any = null;

    // Helper: Dynamically load FaceMesh script if not present
    const ensureScriptLoaded = async (): Promise<boolean> => {
      // @ts-ignore
      if (typeof window.FaceMesh !== 'undefined') return true;

      return new Promise((resolve) => {
        let attempts = 0;
        const checkExist = setInterval(() => {
          // @ts-ignore
          if (typeof window.FaceMesh !== 'undefined') {
            clearInterval(checkExist);
            resolve(true);
          } else if (attempts++ > 25) {
            clearInterval(checkExist);
            resolve(false);
          }
        }, 300);
      });
    };

    const setupDetection = async () => {
      const scriptReady = await ensureScriptLoaded();

      // If MediaPipe FaceMesh is available, initialize it
      // @ts-ignore
      if (scriptReady && typeof window.FaceMesh !== 'undefined') {
        try {
          // @ts-ignore
          const faceMesh = new window.FaceMesh({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
          });

          faceMesh.setOptions({
            maxNumFaces: 3,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          faceMesh.onResults((results: any) => {
            if (!isMounted) return;

            const numFaces = results.multiFaceLandmarks ? results.multiFaceLandmarks.length : 0;
            let lookingAway = false;
            let yaw = 0;

            if (numFaces === 0) {
              missingFramesRef.current += 1;
              multipleFramesRef.current = 0;
              setMetrics((prev) => ({
                ...prev,
                faceCount: 0,
                statusMessage: 'No face detected in camera view',
              }));

              // After 2 consecutive checks (~4-5 seconds absent)
              if (missingFramesRef.current >= 2) {
                triggerViolation('face_missing', 'hard', 'No face detected in webcam view. Please face your screen.');
              }
              return;
            }

            if (numFaces > 1) {
              multipleFramesRef.current += 1;
              missingFramesRef.current = 0;
              setMetrics((prev) => ({
                ...prev,
                faceCount: numFaces,
                statusMessage: `Multiple faces detected (${numFaces} people)`,
              }));

              if (multipleFramesRef.current >= 1) {
                triggerViolation('multiple_faces', 'hard', `Multiple faces detected (${numFaces} people in frame)`);
              }
              return;
            }

            // Exactly 1 face detected
            missingFramesRef.current = 0;
            multipleFramesRef.current = 0;

            if (numFaces === 1 && results.multiFaceLandmarks[0]) {
              const landmarks = results.multiFaceLandmarks[0];
              // Nose: 1, Left cheek: 234, Right cheek: 454
              const nose = landmarks[1];
              const leftCheek = landmarks[234];
              const rightCheek = landmarks[454];

              if (nose && leftCheek && rightCheek) {
                const dLeft = Math.abs(nose.x - leftCheek.x);
                const dRight = Math.abs(nose.x - rightCheek.x);
                const ratio = dLeft / (dRight + 0.0001);

                if (ratio < 0.35 || ratio > 2.8) {
                  lookingAway = true;
                  yaw = ratio < 0.35 ? -45 : 45;
                }
              }

              if (lookingAway) {
                if (!lookAwayTimerRef.current) {
                  lookAwayTimerRef.current = window.setTimeout(() => {
                    triggerViolation('head_turned_away', 'soft', 'Student looking away from exam screen');
                    lookAwayTimerRef.current = null;
                  }, 6000);
                }
              } else {
                if (lookAwayTimerRef.current) {
                  clearTimeout(lookAwayTimerRef.current);
                  lookAwayTimerRef.current = null;
                }
              }

              setMetrics({
                faceCount: 1,
                isLookingAway: lookingAway,
                yawAngle: yaw,
                landmarksDetected: true,
                statusMessage: lookingAway ? 'Looking away from screen' : 'Proctored (Face verified)',
              });
            }
          });

          faceMeshRef.current = faceMesh;
        } catch (err) {
          console.warn('MediaPipe FaceMesh initialization warning:', err);
        }
      }

      // Main detection loop running in the browser
      checkInterval = setInterval(async () => {
        if (!isMounted) return;

        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.paused || video.ended) {
          return;
        }

        // 1. Try MediaPipe FaceMesh if loaded
        if (faceMeshRef.current) {
          try {
            await faceMeshRef.current.send({ image: video });
            return;
          } catch (e) {
            // MediaPipe frame error, fallback to ShapeDetection below
          }
        }

        // 2. Browser native Shape Detection API (window.FaceDetector) supported in Chrome
        // @ts-ignore
        if (typeof window.FaceDetector !== 'undefined') {
          try {
            // @ts-ignore
            const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
            const faces = await detector.detect(video);
            const count = faces ? faces.length : 0;

            if (count === 0) {
              missingFramesRef.current += 1;
              multipleFramesRef.current = 0;
              setMetrics((prev) => ({ ...prev, faceCount: 0, statusMessage: 'No face detected in camera view' }));
              if (missingFramesRef.current >= 2) {
                triggerViolation('face_missing', 'hard', 'No face detected in webcam view. Please face your screen.');
              }
            } else if (count > 1) {
              multipleFramesRef.current += 1;
              missingFramesRef.current = 0;
              setMetrics((prev) => ({ ...prev, faceCount: count, statusMessage: `Multiple faces detected (${count} people)` }));
              triggerViolation('multiple_faces', 'hard', `Multiple faces detected (${count} people in frame)`);
            } else {
              missingFramesRef.current = 0;
              multipleFramesRef.current = 0;
              setMetrics((prev) => ({ ...prev, faceCount: 1, statusMessage: 'Proctored (Face verified)' }));
            }
          } catch (e) {
            // Detector failed
          }
        }
      }, 2500);
    };

    setupDetection();

    return () => {
      isMounted = false;
      if (checkInterval) clearInterval(checkInterval);
      if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
    };
  }, [active, videoRef]);

  return metrics;
};
