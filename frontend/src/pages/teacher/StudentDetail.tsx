import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { ArrowLeft, ShieldAlert, Award, CheckCircle2, AlertTriangle, Edit3, MessageSquare, FileCode2 } from 'lucide-react';

export const StudentDetail: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [data, setData] = useState<any | null>(null);
  const [overrideScores, setOverrideScores] = useState<Record<number, number>>({});
  const [overrideFeedbacks, setOverrideFeedbacks] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchDetail = async () => {
    try {
      const res = await apiClient.get(`/dashboard/students/${attemptId}/detail`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load student detail', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [attemptId]);

  const handleSaveOverride = async (submissionId: number) => {
    const score = overrideScores[submissionId];
    const feedback = overrideFeedbacks[submissionId];
    try {
      await apiClient.patch(`/grading/submissions/${submissionId}`, {
        score: score !== undefined ? Number(score) : undefined,
        feedback: feedback || undefined,
      });
      alert('Grade override applied successfully.');
      fetchDetail();
    } catch (err) {
      alert('Failed to override grade');
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const { student, attempt, events, submissions, viva_questions } = data;

  // Calculate scores including viva
  const subScore = (submissions || []).reduce((sum: number, s: any) => sum + (s.override_score ?? s.score ?? 0), 0);
  const subMax = (submissions || []).length * 100;

  const vivaScore = (viva_questions || []).reduce((sum: number, vq: any) => {
    if (typeof vq.score === 'number' && !isNaN(vq.score)) return sum + vq.score;
    if (vq.understanding_confidence === 'high') return sum + 90;
    if (vq.understanding_confidence === 'medium') return sum + 50;
    if (vq.understanding_confidence === 'low') return sum + 15;
    return sum;
  }, 0);
  const vivaMax = (viva_questions || []).length * 100;

  const totalAggregate = subScore + vivaScore;
  const totalPossible = subMax + vivaMax;
  const overallPct = totalPossible > 0 ? Math.round((totalAggregate / totalPossible) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link to="/teacher" className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          {student?.enrollment_photo_url ? (
            <img
              src={`http://localhost:8000${student.enrollment_photo_url}`}
              alt="Student"
              className="w-16 h-16 rounded-full object-cover border-2 border-sky-500"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xl">
              {student?.name?.[0] || 'S'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{student?.name}</h1>
            <p className="text-sm text-slate-400">{student?.email}</p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-slate-400">Status: <strong className="text-white uppercase">{attempt?.status}</strong></span>
              <span>•</span>
              <span className="text-slate-400">Strikes: <strong className="text-rose-400">{attempt?.integrity_strike_count || 0} / 3</strong></span>
            </div>
          </div>
        </div>

        {/* Total Aggregate Score Badge (Includes Viva) */}
        <div className="bg-slate-900/90 border border-slate-700/80 p-4 rounded-xl text-right min-w-[200px]">
          <div className="text-3xl font-extrabold text-white">
            {overallPct}%
          </div>
          <div className="text-xs text-sky-400 font-semibold mt-0.5">Final Total Aggregate Score</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Exam: {Math.round(subScore)}/{subMax} | Viva: {Math.round(vivaScore)}/{vivaMax}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-rose-400" />
        Integrity Events & Violation Timeline ({events.length})
      </h2>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8 max-h-96 overflow-y-auto space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> No violations detected. Clean assessment attempt.
          </p>
        ) : (
          events.map((ev: any) => (
            <div key={ev.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    ev.severity === 'hard' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {ev.severity} Strike
                  </span>
                  <span className="text-sm font-semibold text-slate-200">{ev.event_type}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{ev.description}</p>
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {ev.evidence_url && (
                <a
                  href={`http://localhost:8000${ev.evidence_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 hover:underline shrink-0"
                >
                  View Snapshot
                </a>
              )}
            </div>
          ))
        )}
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Exam Submissions & Code</h2>
      <div className="space-y-6 mb-8">
        {(submissions || []).map((sub: any, idx: number) => (
          <div key={sub.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-bold text-slate-400">Question {idx + 1}</span>
              <span className="text-sm font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-3 py-1 rounded">
                Current Score: {sub.override_score !== null && sub.override_score !== undefined ? sub.override_score : sub.score} / 100
                {sub.manually_overridden === 'true' && ' (Teacher Override)'}
              </span>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto mb-4 border border-slate-800 max-h-60">
              {sub.answer_text || 'No answer submitted'}
            </pre>

            {sub.ai_feedback && (
              <div className="p-3 bg-slate-900 rounded-xl text-xs text-slate-300 font-mono mb-4 border border-slate-800">
                <strong>Automated Feedback:</strong> {sub.ai_feedback}
              </div>
            )}

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-2">Teacher Grade Override:</span>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="number"
                  placeholder="New Score (0-100)"
                  defaultValue={sub.override_score ?? sub.score ?? ''}
                  onChange={(e) => setOverrideScores({ ...overrideScores, [sub.id]: Number(e.target.value) })}
                  className="w-full sm:w-44 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
                <input
                  type="text"
                  placeholder="Override remarks..."
                  defaultValue={sub.override_feedback ?? sub.ai_feedback ?? ''}
                  onChange={(e) => setOverrideFeedbacks({ ...overrideFeedbacks, [sub.id]: e.target.value })}
                  className="flex-1 w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleSaveOverride(sub.id)}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition whitespace-nowrap"
                >
                  Save Override
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-white mb-4">AI Viva Oral Understanding Q&A</h2>
      <div className="space-y-4">
        {(viva_questions || []).map((vq: any, idx: number) => {
          const vqScore = vq.score ?? (vq.understanding_confidence === 'high' ? 90 : vq.understanding_confidence === 'medium' ? 50 : 15);
          return (
            <div key={vq.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="text-sm font-bold text-slate-200">{idx + 1}. {vq.question_text}</h4>
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
              <p className="text-xs text-slate-400 italic bg-slate-900/60 p-2.5 rounded border border-slate-800/60 mb-2">
                "{vq.student_answer || 'No answer recorded.'}"
              </p>
              {vq.ai_reasoning && (
                <p className="text-xs text-sky-300">
                  <strong>Evaluation:</strong> {vq.ai_reasoning}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
