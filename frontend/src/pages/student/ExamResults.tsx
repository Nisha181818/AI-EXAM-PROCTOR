import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Submission, VivaQuestion, ExamAttempt, Exam } from '../../types';
import { Award, CheckCircle2, ShieldCheck, ArrowLeft, AlertTriangle, FileCode2, MessageSquare } from 'lucide-react';

export const ExamResults: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [vivaQuestions, setVivaQuestions] = useState<VivaQuestion[]>([]);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const [subRes, vivaRes, attRes] = await Promise.all([
          apiClient.get(`/grading/results/${attemptId}`),
          apiClient.get(`/viva/${attemptId}`),
          apiClient.get(`/attempts/${attemptId}`),
        ]);
        setSubmissions(subRes.data);
        setVivaQuestions(vivaRes.data);
        setAttempt(attRes.data);

        if (attRes.data?.exam_id) {
          const exRes = await apiClient.get(`/exams/${attRes.data.exam_id}`);
          setExam(exRes.data);
        }
      } catch (err) {
        console.error('Failed to load results', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [attemptId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  // Calculate Submissions Score
  const submissionsScore = submissions.reduce((sum, s) => sum + (s.override_score ?? s.score ?? 0), 0);
  const submissionsMax = submissions.length * 100;

  // Calculate Viva Score (including viva marks in final total)
  const vivaScore = vivaQuestions.reduce((sum, vq) => {
    if (typeof vq.score === 'number' && !isNaN(vq.score)) {
      return sum + vq.score;
    }
    if (vq.understanding_confidence === 'high') return sum + 90;
    if (vq.understanding_confidence === 'medium') return sum + 50;
    if (vq.understanding_confidence === 'low') return sum + 15;
    return sum;
  }, 0);
  const vivaMax = vivaQuestions.length * 100;

  // Total Aggregate Score (Submissions + Viva)
  const totalScore = submissionsScore + vivaScore;
  const maxPossible = submissionsMax + vivaMax;
  const percentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link to="/student" className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Score Header Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div>
          <span className="text-xs uppercase font-bold text-sky-400 bg-sky-950 border border-sky-800 px-2.5 py-1 rounded">
            Official Evaluation Report
          </span>
          <h1 className="text-2xl font-bold text-white mt-2">{exam?.title || 'Exam Assessment'}</h1>
          <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
            <span>Status: <strong className="text-emerald-400 uppercase">{attempt?.status}</strong></span>
            <span>Strikes Logged: <strong className="text-rose-400">{attempt?.integrity_strike_count || 0} / 3</strong></span>
          </div>
        </div>

        <div className="text-center sm:text-right bg-slate-900/80 p-5 rounded-2xl border border-slate-700/60">
          <div className="text-4xl font-extrabold text-white">
            {percentage}%
          </div>
          <span className="text-xs text-sky-400 font-semibold block mt-1">Final Total Aggregate Score</span>
          <span className="text-[11px] text-slate-400">
            {Math.round(totalScore)} / {maxPossible} Total Marks (Includes Viva)
          </span>
        </div>
      </div>

      {/* Aggregate Score Breakdown Pill */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-5 h-5 text-sky-400" />
            <div>
              <div className="text-sm font-bold text-white">Written & Coding Part</div>
              <div className="text-xs text-slate-400">{submissions.length} Questions Evaluated</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white">{Math.round(submissionsScore)} / {submissionsMax}</div>
            <div className="text-xs text-slate-400">{submissionsMax > 0 ? Math.round((submissionsScore / submissionsMax) * 100) : 0}%</div>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-sm font-bold text-white">Viva Oral Assessment</div>
              <div className="text-xs text-slate-400">{vivaQuestions.length} Questions Evaluated</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-emerald-400">{Math.round(vivaScore)} / {vivaMax}</div>
            <div className="text-xs text-slate-400">{vivaMax > 0 ? Math.round((vivaScore / vivaMax) * 100) : 0}%</div>
          </div>
        </div>
      </div>

      {/* Graded Submissions List */}
      <h2 className="text-lg font-bold text-white mb-4">Question Breakdown & Feedback</h2>
      <div className="space-y-4 mb-8">
        {submissions.map((sub, idx) => {
          const finalSubScore = sub.override_score ?? sub.score;
          return (
            <div key={sub.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-slate-400">Question {idx + 1}</span>
                <span className="text-sm font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 rounded">
                  Score: {finalSubScore !== null && finalSubScore !== undefined ? `${finalSubScore} / 100` : 'Grading...'}
                </span>
              </div>
              {sub.ai_feedback && (
                <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 mt-2 font-mono">
                  {sub.ai_feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Viva Understanding Confidence & Marks */}
      <h2 className="text-lg font-bold text-white mb-4">Post-Exam AI Viva Understanding Evaluation</h2>
      <div className="space-y-4">
        {vivaQuestions.map((vq, idx) => {
          const vqScore = vq.score ?? (vq.understanding_confidence === 'high' ? 90 : vq.understanding_confidence === 'medium' ? 50 : 15);
          return (
            <div key={vq.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="text-sm font-bold text-slate-200">
                  {idx + 1}. {vq.question_text}
                </h4>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2.5 py-0.5 rounded font-bold bg-slate-900 text-slate-200 border border-slate-700">
                    Marks: {vqScore} / 100
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    vq.understanding_confidence === 'high'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : vq.understanding_confidence === 'medium'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>
                    {vq.understanding_confidence || 'Pending'}
                  </span>
                </div>
              </div>
              {vq.student_answer && (
                <p className="text-xs text-slate-400 italic bg-slate-900/60 p-2.5 rounded border border-slate-800/60 mb-2">
                  "{vq.student_answer}"
                </p>
              )}
              {vq.ai_reasoning && (
                <p className="text-xs text-sky-300 font-sans">
                  <strong>AI Evaluation:</strong> {vq.ai_reasoning}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
