import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

import { StudentDashboard } from './pages/student/StudentDashboard';
import { IdentityVerification } from './pages/student/IdentityVerification';
import { ExamRoom } from './pages/student/ExamRoom';
import { VivaPage } from './pages/student/VivaPage';
import { ExamResults } from './pages/student/ExamResults';

import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { ExamBuilder } from './pages/teacher/ExamBuilder';
import { ExamOverview } from './pages/teacher/ExamOverview';
import { StudentDetail } from './pages/teacher/StudentDetail';
import { ClassAnalytics } from './pages/teacher/ClassAnalytics';

const HomeRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Student Routes */}
              <Route element={<ProtectedRoute requiredRole="student" />}>
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/verify/:attemptId" element={<IdentityVerification />} />
                <Route path="/exam/:attemptId" element={<ExamRoom />} />
                <Route path="/viva/:attemptId" element={<VivaPage />} />
                <Route path="/results/:attemptId" element={<ExamResults />} />
              </Route>

              {/* Teacher Routes */}
              <Route element={<ProtectedRoute requiredRole="teacher" />}>
                <Route path="/teacher" element={<TeacherDashboard />} />
                <Route path="/teacher/create-exam" element={<ExamBuilder />} />
                <Route path="/teacher/exams/:examId" element={<ExamOverview />} />
                <Route path="/teacher/exams/:examId/analytics" element={<ClassAnalytics />} />
                <Route path="/teacher/student/:attemptId" element={<StudentDetail />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};
