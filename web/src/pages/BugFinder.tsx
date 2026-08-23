import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Lock, CheckCircle2, ChevronLeft, Loader2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Bug missions, organised as a track per language and a locked ladder inside
 * each one. A student who opens a Hard bug first sees a screen of unfamiliar
 * code and quits, so Medium and Hard stay shut until the level below them is
 * cleared. The server enforces the same rule — the lock here is only the
 * explanation of it.
 */

const LEVELS = ['Easy', 'Medium', 'Hard'] as const;

const LEVEL_STYLE: Record<string, string> = {
  Easy: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  Medium: 'text-amber-700 bg-amber-50 border-amber-100',
  Hard: 'text-rose-700 bg-rose-50 border-rose-100',
};

const TRACK_LABEL: Record<string, string> = {
  python: 'Python', cpp: 'C++', java: 'Java', javascript: 'JavaScript',
  nodejs: 'Node.js', express: 'Express', react: 'React', mongodb: 'MongoDB', sql: 'SQL',
};

const BugFinder: React.FC = () => {
  const { token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const [domains, setDomains] = useState<any[]>([]);
  const [track, setTrack] = useState<any>(null);
  const [level, setLevel] = useState<string>('Easy');
  const [bugs, setBugs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!authLoading && !token) { navigate('/login'); return; }
    if (!token) return;
    axios.get(`${API_URL}/arena/bug-domains`, auth)
      .then((r) => setDomains(r.data.domains))
      .catch(() => void 0)
      .finally(() => setBusy(false));
  }, [token, authLoading]);

  useEffect(() => {
    if (!track) return;
    setBusy(true);
    axios.get(`${API_URL}/arena/bug-problems`, { ...auth, params: { domain: track.domain, difficulty: level, page } })
      .then((r) => { setBugs(r.data.problems); setPages(r.data.pages ?? 1); })
      .catch(() => setBugs([]))
      .finally(() => setBusy(false));
  }, [track?.domain, level, page]);

  const rung = (t: any, lvl: string) => t.ladder?.find((l: any) => l.level === lvl);

  if (busy && !domains.length) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" size={24} /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 pt-24 pb-20">
      <div className="max-w-5xl mx-auto">
        {track ? (
          <button onClick={() => { setTrack(null); setLevel('Easy'); setPage(1); }} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 mb-8 text-sm">
            <ChevronLeft size={16} /> All tracks
          </button>
        ) : (
          <header className="mb-10">
            <h1 className="text-4xl font-black tracking-tight mb-2">Fix the bug</h1>
            <p className="text-slate-500 text-sm max-w-lg">
              Each mission is a real program that almost works. Find the mistake, fix it, make the tests pass.
              Clear five at a level to open the next one.
            </p>
          </header>
        )}

        <AnimatePresence mode="wait">
          {!track ? (
            <motion.div key="tracks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains.map((t) => {
                const solved = LEVELS.reduce((n, l) => n + (t.solved?.[l] ?? 0), 0);
                return (
                  <button
                    key={t.domain}
                    onClick={() => setTrack(t)}
                    className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:border-slate-400 transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-bold">{TRACK_LABEL[t.domain] ?? t.domain}</p>
                      <Bug size={16} className="text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400 mb-4">{t.total} missions · {solved} fixed</p>
                    <div className="flex gap-1.5">
                      {LEVELS.map((l) => {
                        const r = rung(t, l);
                        return (
                          <span key={l} className={`flex-1 text-center text-[10px] font-bold py-1.5 rounded-lg border ${r?.unlocked ? LEVEL_STYLE[l] : 'text-slate-300 bg-slate-50 border-slate-100'}`}>
                            {r?.unlocked ? l : <Lock size={10} className="inline" />}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
              {domains.length === 0 && (
                <p className="col-span-full text-center py-16 text-sm text-slate-400">No bug missions yet.</p>
              )}
            </motion.div>
          ) : (
            <motion.div key="track" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-3xl font-black tracking-tight mb-6">{TRACK_LABEL[track.domain] ?? track.domain}</h2>

              <div className="flex gap-2 mb-6">
                {LEVELS.map((l) => {
                  const r = rung(track, l);
                  const locked = !r?.unlocked;
                  return (
                    <button
                      key={l}
                      disabled={locked}
                      onClick={() => { setLevel(l); setPage(1); }}
                      title={locked ? `Fix ${r?.needs} more ${r?.unlockedBy} bugs first` : undefined}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${locked ? 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed'
                        : level === l ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-slate-200 hover:border-slate-400'}`}
                    >
                      {locked ? <><Lock size={12} className="inline mr-1.5" />{l}</> : l}
                      <span className={`block text-[10px] font-medium mt-0.5 ${level === l && !locked ? 'text-white/50' : 'text-slate-400'}`}>
                        {locked ? `${r?.needs} more ${r?.unlockedBy} to unlock` : `${track.available?.[l] ?? 0} available · ${track.solved?.[l] ?? 0} fixed`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {busy ? (
                <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin text-slate-300" size={22} /></div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {bugs.map((bug, i) => (
                    <button
                      key={bug._id}
                      onClick={() => navigate(`/arena/bug/${bug._id}`)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors ${i ? 'border-t border-slate-100' : ''}`}
                    >
                      {bug.solved
                        ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        : <Bug size={16} className="text-slate-300 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bug.title}</p>
                        {/* How many lines are wrong is the honest difficulty
                            signal, and it gives nothing away about where. */}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {bug.buggyLines} line{bug.buggyLines === 1 ? '' : 's'} to fix · {bug.points} pts
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 shrink-0" />
                    </button>
                  ))}
                  {bugs.length === 0 && <p className="py-16 text-center text-sm text-slate-400">Nothing at this level yet.</p>}
                </div>
              )}

              {pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                  <span className="text-xs text-slate-400 tabular-nums">Page {page} of {pages}</span>
                  <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><ChevronRight size={16} /></button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BugFinder;
