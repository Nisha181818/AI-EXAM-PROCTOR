import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, LogOut, UserCircle } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 text-xl font-bold text-sky-400">
        <ShieldCheck className="w-7 h-7 text-sky-400" />
        <span>AI Exam Proctor</span>
      </Link>
      
      {user ? (
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-slate-300">
            <UserCircle className="w-5 h-5 text-slate-400" />
            <span className="font-medium">{user.name}</span>
            <span className="text-xs uppercase bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded-full font-bold">
              {user.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm text-slate-200 hover:text-white font-medium">Login</Link>
          <Link to="/register" className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-500 text-white rounded-md font-medium transition">Register</Link>
        </div>
      )}
    </nav>
  );
};
