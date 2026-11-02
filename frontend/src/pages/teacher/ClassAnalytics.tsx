import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ArrowLeft, BarChart3, Users, Award } from 'lucide-react';

export const ClassAnalytics: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await apiClient.get(`/dashboard/exams/${examId}/analytics`);
        setAnalytics(res.data);
      } catch (err) {
        console.error('Failed to load class analytics', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [examId]);

  if (isLoading || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const chartData = analytics.question_stats.map((q: any, idx: number) => ({
    name: `Q${idx + 1} (${q.question_type})`,
    avgScore: q.average_score,
    passRate: q.pass_rate,
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link to={`/teacher/exams/${examId}`} className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" /> Back to Exam
      </Link>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 mb-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white">{analytics.exam_title} ? Performance Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Class-wide pass rates and weak topic detection</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Total Students Assessed</span>
            <span className="text-2xl font-bold text-white">{analytics.total_students}</span>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Questions Evaluated</span>
            <span className="text-2xl font-bold text-sky-400">{analytics.question_stats.length}</span>
          </div>
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1">Assessment Type</span>
            <span className="text-2xl font-bold text-emerald-400">Proctored</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8 shadow-xl">
        <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-400" />
          Average Scores & Pass Rates by Question
        </h2>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="avgScore" name="Average Score (%)" fill="#0284c7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="passRate" name="Pass Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="text-base font-bold text-white mb-4">Topic Diagnostics & Pass Rates</h2>
      <div className="space-y-3">
        {analytics.question_stats.map((q: any, idx: number) => (
          <div key={q.question_id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase text-sky-400">Q{idx + 1} ({q.question_type})</span>
              <p className="text-xs text-slate-300 mt-1">{q.question_preview}</p>
            </div>

            <div className="text-right shrink-0">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase inline-block ${
                q.pass_rate >= 70 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}>
                {q.pass_rate >= 70 ? 'Proficient' : 'Weak Topic Area'} ({q.pass_rate}%)
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Avg: {q.average_score}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
