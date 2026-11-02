import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Exam } from '../../types';
import { ArrowLeft, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, BarChart3, Unlock } from 'lucide-react';

export const ExamOverview: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverview = async () => {
    try {
      const [examRes, overviewRes] = await Promise.all([
        apiClient.get(`/exams/${examId}`),
        apiClient.get(`/dashboard/exams/${examId}/overview`),
      ]);
      setExam(examRes.data);
      setStudents(overviewRes.data);
    } catch (err) {
      console.error('Failed to load overview', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [examId]);

  const handleUnlock = async (attemptId: number) => {
    try {
      await apiClient.patch(`/dashboard/attempts/${attemptId}/unlock`);
      fetchOverview();
    } catch (err) {
      alert('Failed to unlock attempt');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link to="/teacher" className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{exam?.title || 'Exam Submissions & Integrity Status'}</h1>
          <p className="text-slate-400 text-sm mt-1">Live monitoring, integrity strikes, and student progress</p>
        </div>
        <Link
          to={`/teacher/exams/${examId}/analytics`}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <BarChart3 className="w-4 h-4 text-sky-400" />
          <span>Class Analytics</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
          No students have started or submitted this exam yet.
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 border-b border-slate-700 text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Integrity Strikes</th>
                <th className="px-6 py-3.5">Score</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {students.map((st) => (
                <tr key={st.attempt_id} className="hover:bg-slate-750 transition">
                  <td className="px-6 py-4 font-medium text-white">
                    <div>{st.student_name}</div>
                    <div className="text-xs text-slate-500 font-normal">{st.student_email}</div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase inline-flex items-center gap-1 ${
                      st.status === 'submitted'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : st.status === 'locked_pending_review'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                        : 'bg-sky-950 text-sky-400 border border-sky-800'
                    }`}>
                      {st.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${st.integrity_strike_count >= 3 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {st.integrity_strike_count} / 3
                      </span>
                      {st.integrity_strike_count >= 3 && (
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 font-mono font-bold text-slate-100">
                    {st.average_score !== null ? `${st.average_score}%` : '?'}
                  </td>

                  <td className="px-6 py-4 text-right space-x-2">
                    {st.status === 'locked_pending_review' && (
                      <button
                        onClick={() => handleUnlock(st.attempt_id)}
                        className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-600/40 rounded text-xs font-semibold inline-flex items-center gap-1 transition"
                      >
                        <Unlock className="w-3.5 h-3.5" /> Unlock
                      </button>
                    )}
                    <Link
                      to={`/teacher/student/${st.attempt_id}`}
                      className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold inline-flex items-center gap-1 transition"
                    >
                      <span>Review Activity</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
