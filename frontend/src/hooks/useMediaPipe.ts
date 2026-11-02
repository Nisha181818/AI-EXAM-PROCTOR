import { useEffect, useRef, useState } from 'react';

export interface MediaPipeMetrics {
  faceCount: number;
  isLookingAway: boolean;
  yawAngle: number;
  landmarksDetected: boolean;
}

export const useMediaPipe = (
  videoRef: React.RefObject<HTMLVideoElement>,
  onViolation?: (type: string, severity: 'soft' | 'hard', desc: string) => void,
  active: boolean = true
) => {
  const [metrics, setMetrics] = useState<MediaPipeMetrics>({
    faceCount: 0,
    isLookingAway: false,
    yawAngle: 0,
    landmarksDetected: false,
  });

  const lookAwayTimerRef = useRef<number | null>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    let isMounted = true;

    const initFaceMesh = async () => {
      // @ts-ignore
      if (typeof window.FaceMesh === 'undefined') {
        console.warn('MediaPipe FaceMesh script not loaded yet, waiting...');
        return;
      }

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
            setMetrics({ faceCount: 0, isLookingAway: false, yawAngle: 0, landmarksDetected: false });
            if (onViolation) {
              onViolation('face_missing', 'hard', 'No face detected in webcam view');
            }
            return;
          }

          if (numFaces > 1) {
            setMetrics((prev) => ({ ...prev, faceCount: numFaces }));
            if (onViolation) {
              onViolation('multiple_faces', 'hard', `Multiple faces detected (${numFaces} people detected)`);
            }
          }

          if (numFaces === 1 && results.multiFaceLandmarks[0]) {
            const landmarks = results.multiFaceLandmarks[0];
            // Nose tip is landmark 1, Left cheek is 234, Right cheek is 454
            const nose = landmarks[1];
            const leftCheek = landmarks[234];
            const rightCheek = landmarks[454];

            if (nose && leftCheek && rightCheek) {
              const dLeft = Math.abs(nose.x - leftCheek.x);
              const dRight = Math.abs(nose.x - rightCheek.x);
              const ratio = dLeft / (dRight + 0.0001);

              // If ratio is far from 1.0, user is turned sideways
              if (ratio < 0.4 || ratio > 2.5) {
                lookingAway = true;
                yaw = ratio < 0.4 ? -45 : 45;
              }
            }

            if (lookingAway) {
              if (!lookAwayTimerRef.current) {
                lookAwayTimerRef.current = window.setTimeout(() => {
                  if (onViolation) {
                    onViolation('head_turned_away', 'soft', 'Student turned head away from screen for over 5 seconds');
                  }
                  lookAwayTimerRef.current = null;
                }, 5000);
              }
            } else {
              if (lookAwayTimerRef.current) {
                clearTimeout(lookAwayTimerRef.current);
                lookAwayTimerRef.current = null;
              }
            }

            setMetrics({
              faceCount: numFaces,
              isLookingAway: lookingAway,
              yawAngle: yaw,
              landmarksDetected: true,
            });
          }
        });

        faceMeshRef.current = faceMesh;

        // Process frames periodically
        const interval = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && faceMeshRef.current) {
            try {
              await faceMeshRef.current.send({ image: videoRef.current });
            } catch (e) {
              // Ignore transient frame send errors
            }
          }
        }, 2500);

        return () => {
          clearInterval(interval);
        };
      } catch (err) {
        console.error('Failed to initialize MediaPipe FaceMesh:', err);
      }
    };

    const cleanup = initFaceMesh();

    return () => {
      isMounted = false;
      if (lookAwayTimerRef.current) {
        clearTimeout(lookAwayTimerRef.current);
      }
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then((fn: any) => fn && fn());
      }
    };
  }, [active]);

  return metrics;
};
