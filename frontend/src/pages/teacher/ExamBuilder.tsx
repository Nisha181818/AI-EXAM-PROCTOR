import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Course } from '../../types';
import { PlusCircle, Trash2, ArrowLeft, Save } from 'lucide-react';

export const ExamBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);

  const [questions, setQuestions] = useState<any[]>([
    {
      type: 'coding',
      base_text: 'Write a Python function `two_sum(nums, target)` that returns the indices of two numbers that add up to target as a list e.g. [0, 1].',
      base_test_cases: [
        { input: '2,7,11,15\n9', expected: '[0, 1]' },
        { input: '3,2,4\n6', expected: '[1, 2]' }
      ],
      reference_solution: 'import sys\nlines = sys.stdin.read().strip().split("\n")\nnums = [int(x) for x in lines[0].split(",")]\ntarget = int(lines[1])\nseen = {}\nfor i, n in enumerate(nums):\n    diff = target - n\n    if diff in seen:\n        print(f"[{seen[diff]}, {i}]")\n        break\n    seen[n] = i\n',
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await apiClient.get('/courses/');
        setCourses(res.data);
        if (res.data.length > 0) setCourseId(res.data[0].id);
      } catch (err) {
        console.error('Failed to load courses', err);
      }
    };
    fetchCourses();
  }, []);

  const handleAddQuestion = (type: 'coding' | 'written') => {
    if (type === 'coding') {
      setQuestions([
        ...questions,
        {
          type: 'coding',
          base_text: '',
          base_test_cases: [{ input: '', expected: '' }],
          reference_solution: '',
        }
      ]);
    } else {
      setQuestions([
        ...questions,
        {
          type: 'written',
          base_text: '',
          rubric: 'Award points for accuracy, clarity, trade-offs, and examples.',
        }
      ]);
    }
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      alert('Please select or create a course first.');
      return;
    }
    setIsSubmitting(true);

    try {
      const examRes = await apiClient.post('/exams/', {
        course_id: Number(courseId),
        title,
        duration_minutes: duration,
      });

      const examId = examRes.data.id;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await apiClient.post('/questions/', {
          exam_id: examId,
          type: q.type,
          base_text: q.base_text,
          rubric: q.rubric || null,
          base_test_cases: q.base_test_cases || null,
          reference_solution: q.reference_solution || null,
          order_index: i,
        });
      }

      navigate('/teacher');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save exam');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <button onClick={() => navigate('/teacher')} className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">Create New Assessment</h1>

        <form onSubmit={handleSaveExam} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(Number(e.target.value))}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Duration (Minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={5}
                max={300}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Exam Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Assessment: Trees, Graphs & Dynamic Programming"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="border-t border-slate-700/80 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Exam Questions ({questions.length})</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('coding')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-sky-400 flex items-center gap-1 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> + Coding Question
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('written')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-emerald-400 flex items-center gap-1 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> + Written Question
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-700 rounded-xl p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase font-bold text-sky-400 bg-sky-950 border border-sky-800 px-2 py-0.5 rounded">
                      Q{idx + 1}: {q.type.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      className="text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Question Prompt</label>
                    <textarea
                      value={q.base_text}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx].base_text = e.target.value;
                        setQuestions(updated);
                      }}
                      rows={3}
                      required
                      placeholder="Describe the task or question..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                    />
                  </div>

                  {q.type === 'written' ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Grading Rubric for AI</label>
                      <textarea
                        value={q.rubric || ''}
                        onChange={(e) => {
                          const updated = [...questions];
                          updated[idx].rubric = e.target.value;
                          setQuestions(updated);
                        }}
                        rows={2}
                        placeholder="Criteria for scoring..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none font-mono"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Teacher Reference Solution</label>
                      <textarea
                        value={q.reference_solution || ''}
                        onChange={(e) => {
                          const updated = [...questions];
                          updated[idx].reference_solution = e.target.value;
                          setQuestions(updated);
                        }}
                        rows={3}
                        placeholder="# Reference Python code..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none font-mono"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Publish Exam'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
