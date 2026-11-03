import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { VivaQuestion } from '../../types';
import { Mic, MicOff, Send, MessageSquare, CheckCircle2, ArrowRight, Video, AlertCircle } from 'lucide-react';

export const VivaPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [vivaQuestions, setVivaQuestions] = useState<VivaQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Video & Audio Stream state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  // Web Speech API recognition reference
  const recognitionRef = useRef<any>(null);

  // 1. Initialize Webcam for Viva
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        setCamError(null);
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: true,
          });
        } catch (micErr) {
          console.warn('Mic access failed during viva cam start, fallback to video-only', micErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setCamActive(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => console.warn('Viva video play failed', err));
        }
      } catch (err: any) {
        console.error('Webcam initialization failed in Viva:', err);
        setCamError('Unable to access camera. Please allow camera permissions.');
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  // Ensure video element receives stream once rendered
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((e) => console.warn('Viva video play error:', e));
    }
  }, [isLoading, vivaQuestions]);

  // 2. Load or generate viva questions
  useEffect(() => {
    const fetchViva = async () => {
      try {
        const res = await apiClient.post(`/viva/generate/${attemptId}`);
        setVivaQuestions(res.data);
      } catch (err) {
        console.error('Failed to load viva questions', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchViva();
  }, [attemptId]);

  // 3. Web Speech API transcription (Chrome SpeechRecognition)
  const toggleSpeechRecognition = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your current browser. Please use Google Chrome or type your answer directly.');
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
      return;
    }

    try {
      setSpeechError(null);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Speech recognition notice: ${event.error}`);
        }
        setIsListening(false);
      };

      // Correct event name is 'onresult' (not 'onresults')
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setCurrentAnswer((prev) => {
            const cleanPrev = prev.trim();
            const textToAdd = finalTranscript.trim();
            if (!textToAdd) return prev;
            return cleanPrev ? `${cleanPrev} ${textToAdd}` : textToAdd;
          });
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition', err);
      setSpeechError('Could not start speech recognition. Please type your response.');
      setIsListening(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) return;
    const currentQ = vivaQuestions[currentIdx];
    if (!currentQ) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post(`/viva/answer/${currentQ.id}`, {
        answer_text: currentAnswer,
      });

      // Update question in state
      const updated = [...vivaQuestions];
      updated[currentIdx] = res.data;
      setVivaQuestions(updated);
      setCurrentAnswer('');

      if (currentIdx < vivaQuestions.length - 1) {
        setCurrentIdx(currentIdx + 1);
      }
    } catch (err) {
      console.error('Error submitting viva answer', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">AI Examiner is analyzing your code and preparing your viva...</p>
        </div>
      </div>
    );
  }

  const allAnswered = vivaQuestions.length > 0 && vivaQuestions.every((q) => q.student_answer);
  const currentQ = vivaQuestions[currentIdx];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 border-b border-slate-700/60 pb-6">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full text-xs font-semibold mb-2">
              <MessageSquare className="w-4 h-4" />
              <span>Interactive Oral Examination</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Post-Exam AI Viva</h1>
            <p className="text-slate-400 text-sm mt-1">
              Verifying genuine conceptual understanding of your submitted code
            </p>
          </div>

          {/* Live Viva Camera Thumbnail */}
          <div className="relative w-44 aspect-video bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700 shadow-lg shrink-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>VIVA CAM ON</span>
            </div>
            {camError && (
              <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center p-2 text-center text-[10px] text-rose-300">
                {camError}
              </div>
            )}
          </div>
        </div>

        {allAnswered ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Viva Assessment Complete!</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your viva answers have been evaluated and your viva marks are now compiled into your final total score.
            </p>
            <button
              onClick={() => navigate(`/results/${attemptId}`)}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition inline-flex items-center gap-2 shadow-lg shadow-sky-950"
            >
              <span>View Full Exam & Viva Results</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            {/* Progress indicators */}
            <div className="flex items-center justify-between mb-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Question {currentIdx + 1} of {vivaQuestions.length}</span>
              <span>Code Understanding Check</span>
            </div>

            {/* Question Card */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-bold text-slate-100 mb-2">
                {currentQ?.question_text}
              </h3>
              <p className="text-xs text-slate-500">
                Explain your rationale, algorithmic logic, or trade-offs clearly. You can speak into your microphone or type your response.
              </p>
            </div>

            {/* Speech error notice if any */}
            {speechError && (
              <div className="mb-4 bg-amber-950/70 border border-amber-800 text-amber-200 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{speechError}</span>
              </div>
            )}

            {/* Response Area */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  Your Answer:
                </label>
                {isListening && (
                  <span className="text-xs text-rose-400 font-semibold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Transcribing speech... speak now
                  </span>
                )}
              </div>
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                rows={5}
                placeholder="I chose this data structure because... (Speak via microphone or type here)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-sans leading-relaxed"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 border transition ${
                  isListening
                    ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-950 animate-pulse'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-sky-400" />}
                <span>{isListening ? 'Stop Listening' : 'Speak via Mic (Voice-to-Text)'}</span>
              </button>

              <button
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || !currentAnswer.trim()}
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-sky-950"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Evaluating...' : 'Submit Answer'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
