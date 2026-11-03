import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../api/client';
import { Exam, Course } from '../../types';
import { BookOpen, Clock, ShieldCheck, Upload, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsRes, coursesRes] = await Promise.all([
          apiClient.get('/exams/'),
          apiClient.get('/courses/'),
        ]);
        setExams(examsRes.data);
        setCourses(coursesRes.data);
      } catch (err) {
        console.error('Error fetching student data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setPhotoUploading(true);
    setPhotoMsg('');
    try {
      const res = await apiClient.post('/auth/upload-enrollment-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoMsg('Enrollment photo saved & facial embedding generated successfully!');
      if (user) {
        updateUser({ ...user, enrollment_photo_url: res.data.enrollment_photo_url });
      }
    } catch (err: any) {
      setPhotoMsg(err.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleStartExam = async (examId: number) => {
    try {
      const res = await apiClient.post(`/attempts/start/${examId}`);
      const attempt = res.data;
      if (attempt.identity_verified === 'passed') {
        navigate(`/exam/${attempt.id}`);
      } else {
        navigate(`/verify/${attempt.id}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start exam');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header Banner */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name}!</h1>
          <p className="text-slate-400 mt-1">Ready for your upcoming assessments? Make sure your webcam is ready.</p>
        </div>

        {/* Enrollment Photo Section */}
        <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-4 flex items-center gap-4 w-full md:w-auto">
          {user?.enrollment_photo_url ? (
            <img
              src={`http://localhost:8000${user.enrollment_photo_url}`}
              alt="Enrollment"
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shrink-0"
              onError={(e) => {
                // Fallback icon if image path error
                (e.target as any).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {user?.enrollment_photo_url ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Enrollment Photo On File
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Enrollment Photo Required
                </span>
              )}
            </div>
            <label className="mt-1 inline-block text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer underline">
              {photoUploading ? 'Uploading...' : user?.enrollment_photo_url ? 'Update Photo' : 'Upload Official Photo'}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={photoUploading} />
            </label>
            {photoMsg && <p className="text-xs text-emerald-400 mt-1">{photoMsg}</p>}
          </div>
        </div>
      </div>

      {/* Available Exams */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-400" />
          Active & Scheduled Exams
        </h2>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
            No active exams currently scheduled. When your instructor creates an exam, it will appear here automatically.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {exams.map((exam) => {
              const course = courses.find((c) => c.id === exam.course_id);
              return (
                <div key={exam.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase text-sky-400 bg-sky-950 border border-sky-800/60 px-2 py-0.5 rounded">
                      {course?.name || 'Computer Science'}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2">{exam.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {exam.duration_minutes} Minutes
                      </span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Proctored Environment
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Identity check required</span>
                    <button
                      onClick={() => handleStartExam(exam.id)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
                    >
                      <span>Enter Exam</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
