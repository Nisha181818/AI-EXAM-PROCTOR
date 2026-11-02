import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { VivaQuestion } from '../../types';
import { Mic, MicOff, Send, MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react';

export const VivaPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [vivaQuestions, setVivaQuestions] = useState<VivaQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load or generate viva questions
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

  // Web Speech API speech-to-text
  const toggleSpeechRecognition = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please type your answer.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresults = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setCurrentAnswer((prev) => prev + ' ' + transcript);
    };

    recognition.start();
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) return;
    const currentQ = vivaQuestions[currentIdx];
    if (!currentQ) return;

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
          <p className="text-slate-400 text-sm">AI Examiner is analyzing your submitted code...</p>
        </div>
      </div>
    );
  }

  const allAnswered = vivaQuestions.length > 0 && vivaQuestions.every((q) => q.student_answer);
  const currentQ = vivaQuestions[currentIdx];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-sky-500/10 rounded-full mb-3">
            <MessageSquare className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Post-Exam AI Viva Examination</h1>
          <p className="text-slate-400 text-sm mt-1">
            Verifying genuine conceptual understanding of your submitted code
          </p>
        </div>

        {allAnswered ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Viva Assessment Complete!</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your responses have been recorded and evaluated by the AI examiner.
            </p>
            <button
              onClick={() => navigate(`/results/${attemptId}`)}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition inline-flex items-center gap-2"
            >
              <span>View Full Exam Results</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            {/* Progress indicators */}
            <div className="flex items-center justify-between mb-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Question {currentIdx + 1} of {vivaQuestions.length}</span>
              <span>Conceptual Verification</span>
            </div>

            {/* Question Card */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-bold text-slate-100 mb-2">
                {currentQ?.question_text}
              </h3>
              <p className="text-xs text-slate-500">
                Explain your rationale, algorithmic logic, or trade-offs clearly.
              </p>
            </div>

            {/* Response Area */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Your Answer (Type or speak using mic):
              </label>
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                rows={5}
                placeholder="I chose this data structure because..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 border transition ${
                  isListening
                    ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-sky-400" />}
                <span>{isListening ? 'Stop Recording' : 'Voice Input (Mic)'}</span>
              </button>

              <button
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || !currentAnswer.trim()}
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Submit & Next Question</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
