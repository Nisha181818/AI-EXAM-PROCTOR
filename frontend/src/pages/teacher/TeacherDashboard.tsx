import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Exam, Course } from '../../types';
import { BookOpen, PlusCircle, Users, BarChart3, Clock, ArrowRight } from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [examsRes, coursesRes] = await Promise.all([
        apiClient.get('/exams/'),
        apiClient.get('/courses/'),
      ]);
      setExams(examsRes.data);
      setCourses(coursesRes.data);
    } catch (err) {
      console.error('Failed to load teacher dashboard', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    try {
      await apiClient.post('/courses/', { name: newCourseName });
      setNewCourseName('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create course');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Instructor Control Center</h1>
          <p className="text-slate-400 text-sm mt-1">Manage exam security, view live proctoring logs, and analyze performance.</p>
        </div>
        <Link
          to="/teacher/create-exam"
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-sky-950"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Exam
        </Link>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-400" />
          Active Courses ({courses.length})
        </h2>

        <div className="flex flex-wrap gap-3 mb-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl text-sm font-semibold text-slate-200">
              {c.name}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateCourse} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            placeholder="Add new course (e.g. Data Structures)..."
            className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition"
          >
            Add Course
          </button>
        </form>
      </div>

      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-sky-400" />
        Managed Exams
      </h2>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
          No exams created yet. Click "Create New Exam" above to get started.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {exams.map((exam) => {
            const course = courses.find((c) => c.id === exam.course_id);
            return (
              <div key={exam.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-sky-400 bg-sky-950 border border-sky-800 px-2 py-0.5 rounded">
                    {course?.name || 'Computer Science'}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-2">{exam.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {exam.duration_minutes} Mins
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  <Link
                    to={`/teacher/exams/${exam.id}/analytics`}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                    Analytics
                  </Link>

                  <Link
                    to={`/teacher/exams/${exam.id}`}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <span>View Students & Submissions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
