import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Bug, Hammer, CheckCircle2, AlertTriangle, Code, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BugFinder: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const [bugs, setBugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!authLoading && !token) {
      navigate('/login');
      return;
    }
    if (token) {
      fetchBugs();
    }
  }, [token, authLoading]);

  const fetchBugs = async () => {
    try {
      const res = await axios.get(`${API_URL}/arena/bug-problems`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBugs(res.data.problems);
    } catch (err) {
      console.error('Failed to fetch bug missions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center pb-24">
      <header className="max-w-4xl w-full text-center mb-20 pt-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-rose-50 w-28 h-28 rounded-[48px] flex items-center justify-center mx-auto mb-10 border border-rose-100 shadow-xl shadow-rose-200/20"
        >
          <Bug size={48} className="text-rose-600" />
        </motion.div>
        <h1 className="text-6xl font-black  tracking-tighter uppercase text-slate-900 mb-4 leading-none">Bug Finder Protocol</h1>
        <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.4em]">Sanitation & Code Integrity Missions</p>
      </header>

      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-3 gap-10">
        {bugs.length === 0 && !loading && (
          <div className="col-span-full border-2 border-dashed border-slate-200 p-24 rounded-[56px] text-center bg-white/50">
            <Sparkles size={64} className="text-slate-200 mx-auto mb-6" />
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Codebase sanitized. No vulnerabilities detected.</p>
          </div>
        )}

        {bugs.map((bug, i) => (
          <motion.div
            key={bug._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white border border-slate-100 p-10 rounded-[48px] hover:border-rose-300 transition-all group shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-rose-500/5"
          >
            <div className="flex items-center justify-between mb-10">
              <div className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest ${bug.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                {bug.difficulty} Protocol
              </div>
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{bug.language}</span>
            </div>

            <h3 className="text-2xl font-black  tracking-tighter text-slate-900 uppercase mb-4 line-clamp-1 group-hover:text-rose-600 transition-colors">{bug.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-10 line-clamp-3 font-medium">{bug.description}</p>

            <div className="bg-slate-50 p-8 rounded-[32px] mb-10 border border-slate-100 group-hover:bg-white group-hover:border-rose-100 transition-all shadow-inner group-hover:shadow-none">
              <Code size={16} className="text-slate-300 mb-3" />
              <pre className="text-[11px] text-slate-400 font-mono mb-0 leading-relaxed overflow-hidden">
                {bug.buggyCode.substring(0, 100)}...
              </pre>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-xl">
                  <Zap size={16} className="text-amber-500" />
                </div>
                <span className="text-[11px] font-black uppercase text-slate-900 tracking-tighter">{bug.points} CP Bounty</span>
              </div>
              <button
                onClick={() => navigate(`/arena/bug/${bug._id}`)}
                className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2rem] hover:bg-rose-600 shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
              >
                Engage Mission
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Global Bounty Stats */}
      <div className="mt-24 max-w-5xl w-full flex items-center justify-around border-t border-slate-200 pt-16">
        <div className="text-center group">
          <div className="bg-emerald-50 w-16 h-16 rounded-[24px] flex items-center justify-center mx-auto mb-4 border border-emerald-100 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/5">
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
          <p className="text-4xl font-black text-slate-900  tracking-tighter leading-none mb-2">{user?.codingStats?.totalSolved || '0'}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Bugs Squashed</p>
        </div>
        <div className="text-center group">
          <div className="bg-amber-50 w-16 h-16 rounded-[24px] flex items-center justify-center mx-auto mb-4 border border-amber-100 group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/5">
            <AlertTriangle size={28} className="text-amber-500" />
          </div>
          <p className="text-4xl font-black text-slate-900  tracking-tighter leading-none mb-2">{user?.contestHistory?.length || '0'}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Missions Logged</p>
        </div>
        <div className="text-center group">
          <div className="bg-indigo-50 w-16 h-16 rounded-[24px] flex items-center justify-center mx-auto mb-4 border border-indigo-100 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/5">
            <Hammer size={28} className="text-indigo-500" />
          </div>
          <p className="text-4xl font-black text-slate-900  tracking-tighter leading-none mb-2">{(user?.codingStats?.totalSolved || 0) * 50}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">CP Distributed</p>
        </div>
      </div>
    </div>
  );
};

export default BugFinder;
