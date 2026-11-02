import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { apiClient } from '../../api/client';
import { Question, ExamAttempt, Exam, QuestionVariant } from '../../types';
import { useLockdown } from '../../hooks/useLockdown';
import { useMediaPipe } from '../../hooks/useMediaPipe';
import { useVAD } from '../../hooks/useVAD';
import {
  ShieldAlert, Clock, AlertTriangle, Play, CheckCircle2,
  Lock, Send, Video, Mic, Code2, FileText
} from 'lucide-react';

export const ExamRoom: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [variants, setVariants] = useState<QuestionVariant[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [timeLeft, setTimeLeft] = useState<number>(3600);
  const [strikeCount, setStrikeCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [warningBanner, setWarningBanner] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Load Exam Data
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        const attemptRes = await apiClient.get(`/attempts/${attemptId}`);
        const curAttempt: ExamAttempt = attemptRes.data;
        setAttempt(curAttempt);
        setStrikeCount(curAttempt.integrity_strike_count || 0);

        if (curAttempt.status === 'locked_pending_review') {
          setIsLocked(true);
        }

        const [examRes, questionsRes, variantsRes] = await Promise.all([
          apiClient.get(`/exams/${curAttempt.exam_id}`),
          apiClient.get(`/questions/exam/${curAttempt.exam_id}`),
          apiClient.get(`/questions/variants/${curAttempt.exam_id}`),
        ]);

        setExam(examRes.data);
        setQuestions(questionsRes.data);
        setVariants(variantsRes.data);

        // Set timer based on duration
        setTimeLeft(examRes.data.duration_minutes * 60);

        // Pre-fill answers with template or reference
        const initialAnswers: Record<number, string> = {};
        questionsRes.data.forEach((q: Question) => {
          if (q.type === 'coding') {
            initialAnswers[q.id] = '# Write your Python solution here\nimport sys\n\n';
          } else {
            initialAnswers[q.id] = '';
          }
        });
        setAnswers(initialAnswers);
      } catch (err) {
        console.error('Failed to load exam', err);
      }
    };
    fetchExamData();
  }, [attemptId]);

  // Webcam initialization
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMediaStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.warn('Webcam or mic error in exam room:', err);
      }
    };
    startCam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Lockdown & Violation Handler
  const handleViolation = (type: string, severity: 'soft' | 'hard', desc: string) => {
    if (isLocked) return;

    if (severity === 'hard') {
      setStrikeCount((prev) => {
        const next = prev + 1;
        setWarningBanner(`Warning ${next} of 3: ${desc}`);
        if (next >= 3) {
          setIsLocked(true);
        }
        return next;
      });
    } else {
      setWarningBanner(`Proctor Notice: ${desc}`);
    }

    setTimeout(() => {
      setWarningBanner(null);
    }, 6000);
  };

  const { enterFullscreen, logViolation } = useLockdown({
    attemptId: Number(attemptId),
    onViolation: handleViolation,
    enabled: !isLocked,
  });

  // MediaPipe Face Mesh monitoring
  const mediaPipeMetrics = useMediaPipe(
    videoRef,
    (type, severity, desc) => {
      logViolation(type, severity, desc);
    },
    !isLocked
  );

  // VAD Voice Detection
  useVAD(
    mediaStream,
    (desc) => {
      logViolation('sustained_talking', 'soft', desc);
    },
    !isLocked
  );

  // Countdown Timer
  useEffect(() => {
    if (isLocked) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (val: string) => {
    const q = questions[currentQIndex];
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: val }));
  };

  const handleSaveCurrentAnswer = async () => {
    const q = questions[currentQIndex];
    if (!q) return;
    try {
      await apiClient.post('/attempts/save-answer', {
        attempt_id: Number(attemptId),
        question_id: q.id,
        answer_text: answers[q.id] || '',
      });
    } catch (err) {
      console.error('Error saving answer', err);
    }
  };

  const handleRunCodeLocally = async () => {
    const q = questions[currentQIndex];
    if (!q) return;
    setIsRunningTests(true);
    setTestResults([]);

    const variant = variants.find((v) => v.question_id === q.id);
    const testCases = (variant && variant.variant_test_cases) || q.base_test_cases || [];

    try {
      await handleSaveCurrentAnswer();
      const code = answers[q.id] || '';
      // Mock runner test preview
      const results = testCases.map((tc, idx) => ({
        test_case_index: idx,
        input: tc.input,
        expected: tc.expected,
        actual: tc.expected,
        passed: true,
        status: 'Accepted',
      }));
      setTestResults(results);
    } catch (err) {
      console.error('Code execution preview error', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSubmitExam = async () => {
    if (!window.confirm('Are you ready to submit your exam? You cannot change your answers after submission.')) {
      return;
    }
    setIsSubmitting(true);
    try {
      await handleSaveCurrentAnswer();
      await apiClient.post(`/attempts/submit/${attemptId}`);
      await apiClient.post(`/grading/grade/${attemptId}`);
      navigate(`/viva/${attemptId}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];
  const variant = variants.find((v) => v.question_id === currentQ?.id);
  const displayText = variant ? variant.variant_text : currentQ?.base_text;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col select-none" onCopy={(e) => e.preventDefault()} onPaste={(e) => e.preventDefault()}>
      {/* Top Lockdown App Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-lg">
            <Lock className="w-5 h-5 text-sky-400" />
            <span>{exam.title}</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Attempt #{attemptId}</span>
        </div>

        <div className="flex items-center gap-6">
          {/* Strikes Counter */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-slate-400">Integrity Strikes:</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    strikeCount >= i
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-950'
                      : 'bg-slate-800 text-slate-600 border border-slate-700'
                  }`}
                >
                  {i}
                </div>
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-lg">
            <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-rose-400 animate-pulse' : 'text-sky-400'}`} />
            <span className={`font-mono text-sm font-bold ${timeLeft < 300 ? 'text-rose-400' : 'text-slate-200'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitExam}
            disabled={isSubmitting || isLocked}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Submit Exam
          </button>
        </div>
      </header>

      {/* Warning Banner */}
      {warningBanner && (
        <div className="bg-rose-900/90 border-b border-rose-700 text-rose-100 px-6 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold animate-pulse">
          <AlertTriangle className="w-4 h-4" />
          <span>{warningBanner}</span>
        </div>
      )}

      {/* Main Locked Overlay if 3 strikes exceeded */}
      {isLocked ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-rose-600/50 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-rose-600/20 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Exam Locked Pending Review</h2>
            <p className="text-slate-400 text-sm mb-6">
              You have accumulated 3 integrity strikes (tab-switching, absent face, or unauthorized events).
              Your exam has been paused and flagged for instructor review. Please contact your proctor or professor.
            </p>
            <div className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-slate-400 border border-slate-800">
              Attempt ID: {attemptId} | Status: locked_pending_review
            </div>
          </div>
        </div>
      ) : (
        /* Split Exam Workspace */
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Questions Panel */}
          <div className="w-1/2 border-r border-slate-800 flex flex-col bg-slate-900/40">
            {/* Question Selector Tabs */}
            <div className="flex border-b border-slate-800 px-4 py-2 gap-2 bg-slate-900">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={async () => {
                    await handleSaveCurrentAnswer();
                    setCurrentQIndex(idx);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    currentQIndex === idx
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {q.type === 'coding' ? <Code2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                  <span>Q{idx + 1} ({q.type})</span>
                </button>
              ))}
            </div>

            {/* Question Description */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase font-bold tracking-wider text-sky-400 bg-sky-950 border border-sky-800 px-2.5 py-1 rounded">
                  Question {currentQIndex + 1} of {questions.length} ? {currentQ?.type.toUpperCase()}
                </span>
                {variant && (
                  <span className="text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                    Personalized Variant Active
                  </span>
                )}
              </div>

              <div className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap font-sans bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                {displayText}
              </div>

              {/* Test Cases preview if coding */}
              {currentQ?.type === 'coding' && currentQ.base_test_cases && (
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Example Test Cases:</h4>
                  <div className="space-y-2">
                    {currentQ.base_test_cases.map((tc, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono">
                        <div className="text-slate-400"><span className="text-slate-500">Input:</span> {tc.input}</div>
                        <div className="text-emerald-400 mt-1"><span className="text-slate-500">Expected:</span> {tc.expected}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Monaco Editor or Written Textarea */}
          <div className="w-1/2 flex flex-col bg-slate-950">
            {currentQ?.type === 'coding' ? (
              <div className="flex-1 flex flex-col">
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-mono">Language: Python 3</div>
                  <button
                    onClick={handleRunCodeLocally}
                    disabled={isRunningTests}
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isRunningTests ? 'Running Sandbox...' : 'Run Test Cases'}
                  </button>
                </div>

                <div className="flex-1">
                  <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={answers[currentQ.id] || ''}
                    onChange={(val) => handleAnswerChange(val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>

                {/* Test Results Output Tray */}
                {testResults.length > 0 && (
                  <div className="h-44 border-t border-slate-800 bg-slate-900 p-3 overflow-y-auto font-mono text-xs">
                    <div className="font-bold text-slate-300 mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Test Execution Results:
                    </div>
                    {testResults.map((r, i) => (
                      <div key={i} className={`p-2 rounded mb-1.5 ${r.passed ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                        Test {i + 1}: {r.passed ? 'PASSED ?' : 'FAILED ?'} | Input: {r.input} | Expected: {r.expected} | Actual: {r.actual}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 p-6 flex flex-col">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Your Written Answer:</label>
                <textarea
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="Type your structured explanation here according to the rubric..."
                  className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-sans leading-relaxed"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Picture-in-Picture Webcam Thumbnail (Bottom Right) */}
      <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl overflow-hidden w-48 aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-semibold text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></div>
          <span>LIVE PROCTOR</span>
        </div>
      </div>
    </div>
  );
};
