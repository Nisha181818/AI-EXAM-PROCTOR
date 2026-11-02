import { useEffect, useRef, useState } from 'react';

export const useVAD = (
  stream: MediaStream | null,
  onSpeechDetected?: (desc: string) => void,
  active: boolean = true
) => {
  const [isTalking, setIsTalking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const talkingDurationRef = useRef(0);

  useEffect(() => {
    if (!active || !stream || stream.getAudioTracks().length === 0) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let microphone: MediaStreamAudioSourceNode | null = null;
    let intervalId: any = null;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;

      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      intervalId = setInterval(() => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        // Threshold for sustained voice speech
        if (normalized > 35) {
          talkingDurationRef.current += 1;
          setIsTalking(true);
          if (talkingDurationRef.current >= 4) { // Sustained speech for ~2 seconds
            if (onSpeechDetected) {
              onSpeechDetected(`Sustained talking detected (level: ${normalized}%)`);
            }
            talkingDurationRef.current = 0;
          }
        } else {
          talkingDurationRef.current = 0;
          setIsTalking(false);
        }
      }, 500);
    } catch (err) {
      console.warn('VAD AudioContext init error:', err);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (microphone) microphone.disconnect();
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [stream, active]);

  return { isTalking, audioLevel };
};
