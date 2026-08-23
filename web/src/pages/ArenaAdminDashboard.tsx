import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
   Plus, Database, Trophy, ChevronRight, Bug, Download, Search,
   AlertTriangle, CheckCircle2, Users, Calendar, Loader2, ChevronLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Admin console for the coding arena.
 *
 * Rewritten for plain language and working tabs: the previous version labelled
 * everything in mission jargon ("Test cases", "Architect Challenge"),
 * left two of its four tabs rendering nothing, and listed the whole problem
 * bank unfiltered — unusable once the bank holds thousands of problems.
 */

type Tab = 'problems' | 'bugs' | 'contests';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const DIFF_STYLE: Record<string, string> = {
   Easy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
   Medium: 'bg-amber-50 text-amber-700 border-amber-100',
   Hard: 'bg-rose-50 text-rose-700 border-rose-100',
};

const TABS: { id: Tab; label: string; hint: string }[] = [
   { id: 'problems', label: 'Problems', hint: 'The bank contests and 1v1 matches draw from' },
   { id: 'bugs', label: 'Bug missions', hint: 'Broken programs students fix, by track and level' },
   { id: 'contests', label: 'Contests', hint: 'Scheduled, running and finished' },
];

const fmtDate = (d?: string) =>
   d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const ArenaAdminDashboard: React.FC = () => {
   const { token, loading: authLoading } = useAuth();
   const navigate = useNavigate();
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

   const [tab, setTab] = useState<Tab>('problems');
   const [stats, setStats] = useState<any>(null);
   const [rows, setRows] = useState<any[]>([]);
   const [coverage, setCoverage] = useState<any[]>([]);
   const [total, setTotal] = useState(0);
   const [pages, setPages] = useState(1);
   const [page, setPage] = useState(1);
   const [q, setQ] = useState('');
   const [difficulty, setDifficulty] = useState('');
   const [domain, setDomain] = useState('');
   const [busy, setBusy] = useState(true);

   const auth = { headers: { Authorization: `Bearer ${token}` } };

   useEffect(() => {
      if (!authLoading && !token) navigate('/login');
   }, [token, authLoading]);

   useEffect(() => {
      if (!token) return;
      axios.get(`${API_URL}/arena/admin/stats`, auth).then((r) => setStats(r.data.stats)).catch(() => void 0);
   }, [token]);

   // Filters reset the page, or a search from page 4 lands on an empty page 4.
   useEffect(() => { setPage(1); }, [tab, q, difficulty, domain]);

   const load = useCallback(async () => {
      if (!token) return;
      setBusy(true);
      try {
         if (tab === 'contests') {
            const res = await axios.get(`${API_URL}/arena/admin/contests`, auth);
            setRows(res.data.contests);
            setTotal(res.data.contests.length);
            setPages(1);
         } else {
            const path = tab === 'problems' ? 'problems' : 'bug-problems';
            const res = await axios.get(`${API_URL}/arena/admin/${path}`, {
               ...auth,
               params: { q, difficulty, domain: tab === 'bugs' ? domain : undefined, page },
            });
            setRows(tab === 'problems' ? res.data.problems : res.data.bugs);
            setTotal(res.data.total ?? 0);
            setPages(res.data.pages ?? 1);
            setCoverage(res.data.coverage ?? []);
         }
      } catch {
         setRows([]);
      } finally {
         setBusy(false);
      }
   }, [token, tab, q, difficulty, domain, page]);

   // Debounced so typing in the search box does not fire a request per keystroke.
   useEffect(() => {
      const t = setTimeout(load, q ? 300 : 0);
      return () => clearTimeout(t);
   }, [load]);

   const domains = [...new Set(coverage.map((c: any) => c._id.domain))].sort();
   const coverageFor = (d: string, level: string) =>
      coverage.find((c: any) => c._id.domain === d && c._id.difficulty === level)?.count ?? 0;

   return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 pt-24">
         <div className="max-w-7xl mx-auto">
            <header className="mb-10">
               <h1 className="text-4xl font-black tracking-tight mb-2">Arena admin</h1>
               <p className="text-slate-500 text-sm">
                  Add problems, build bug tracks and schedule contests. Everything students solve comes from here.
               </p>
            </header>

            {/* Actions, named after what they do rather than what they evoke. */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
               {[
                  { label: 'Import problems', sub: 'From LeetCode or Codeforces', icon: Download, to: '/arena/admin/import', primary: true },
                  { label: 'Write a problem', sub: 'Statement and test cases by hand', icon: Plus, to: '/arena/admin/create-problem' },
                  { label: 'Add a bug mission', sub: 'Broken code students must fix', icon: Bug, to: '/arena/admin/create-bug' },
                  { label: 'Schedule a contest', sub: 'Pick problems, set the window', icon: Trophy, to: '/arena/admin/create-contest' },
               ].map((a) => (
                  <button
                     key={a.to}
                     onClick={() => navigate(a.to)}
                     className={`text-left p-5 rounded-2xl border transition-all active:scale-[0.98] ${a.primary
                        ? 'bg-zinc-900 border-zinc-900 text-white hover:bg-black'
                        : 'bg-white border-slate-200 hover:border-slate-400'}`}
                  >
                     <a.icon size={20} className={a.primary ? 'text-white mb-3' : 'text-slate-900 mb-3'} />
                     <p className="font-bold text-sm">{a.label}</p>
                     <p className={`text-xs mt-0.5 ${a.primary ? 'text-white/50' : 'text-slate-400'}`}>{a.sub}</p>
                  </button>
               ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
               {[
                  { label: 'Problems', value: stats?.totalProblems ?? 0, icon: Database },
                  { label: 'Bug missions', value: stats?.totalBugs ?? 0, icon: Bug },
                  { label: 'Contests', value: stats?.totalContests ?? 0, icon: Trophy },
                  { label: 'Running now', value: stats?.ongoingContests ?? 0, icon: Users },
               ].map((s) => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                     <s.icon size={18} className="text-slate-300" />
                     <div>
                        <p className="text-2xl font-black tracking-tight leading-none">{s.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                     </div>
                  </div>
               ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
               <div className="flex border-b border-slate-100 overflow-x-auto">
                  {TABS.map((t) => (
                     <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-6 py-5 text-sm font-bold whitespace-nowrap relative transition-colors ${tab === t.id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        {t.label}
                        {tab === t.id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900" />}
                     </button>
                  ))}
               </div>

               <div className="px-6 pt-5 pb-2">
                  <p className="text-xs text-slate-400 mb-4">{TABS.find((t) => t.id === tab)?.hint}</p>

                  {tab !== 'contests' && (
                     <div className="flex flex-wrap gap-2 mb-5">
                        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3">
                           <Search size={15} className="text-slate-400" />
                           <input
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              placeholder="Search by title"
                              className="flex-1 bg-transparent py-2.5 text-sm outline-none"
                           />
                        </div>
                        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                           className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                           <option value="">All levels</option>
                           {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        {tab === 'bugs' && domains.length > 0 && (
                           <select value={domain} onChange={(e) => setDomain(e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                              <option value="">All tracks</option>
                              {domains.map((d) => <option key={d} value={d}>{d}</option>)}
                           </select>
                        )}
                        <span className="ml-auto self-center text-xs text-slate-400">{total} total</span>
                     </div>
                  )}
               </div>

               {/* Coverage tells the admin the one thing that matters about a
                   track: whether it has enough missions at each level for the
                   Easy-Medium-Hard ladder to be worth gating. */}
               {tab === 'bugs' && domains.length > 0 && (
                  <div className="px-6 pb-5">
                     <div className="border border-slate-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                           <thead className="bg-slate-50 text-xs text-slate-400">
                              <tr>
                                 <th className="text-left font-medium px-4 py-2.5">Track</th>
                                 {DIFFICULTIES.map((d) => <th key={d} className="text-right font-medium px-4 py-2.5">{d}</th>)}
                              </tr>
                           </thead>
                           <tbody>
                              {domains.map((d) => (
                                 <tr key={d} className="border-t border-slate-100">
                                    <td className="px-4 py-2.5 font-medium">{d}</td>
                                    {DIFFICULTIES.map((lvl) => {
                                       const n = coverageFor(d, lvl);
                                       return (
                                          <td key={lvl} className={`px-4 py-2.5 text-right tabular-nums ${n < 20 ? 'text-amber-600' : 'text-slate-600'}`}>
                                             {n}
                                          </td>
                                       );
                                    })}
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               )}

               <div className="px-6 pb-6">
                  {busy && rows.length === 0 ? (
                     <div className="py-16 text-center text-slate-300"><Loader2 className="mx-auto animate-spin" size={22} /></div>
                  ) : rows.length === 0 ? (
                     <div className="py-16 text-center">
                        <p className="text-sm text-slate-400 mb-4">Nothing here yet.</p>
                        {tab === 'problems' && (
                           <button onClick={() => navigate('/arena/admin/import')} className="text-sm font-bold underline underline-offset-4">
                              Import some problems
                           </button>
                        )}
                        {tab === 'bugs' && (
                           <p className="text-xs text-slate-400">Run <code className="bg-slate-100 px-1.5 py-0.5 rounded">node scripts/seedBugProblems.mjs</code> to fill the tracks.</p>
                        )}
                     </div>
                  ) : (
                     <AnimatePresence mode="wait">
                        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-slate-200 rounded-2xl overflow-hidden">
                           {rows.map((row: any, i: number) => (
                              <div key={row._id} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${i ? 'border-t border-slate-100' : ''}`}>
                                 <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{row.title}</p>
                                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                                       {tab === 'problems' && `${row.category ?? 'General'} · ${row.totalCases} cases (${row.hiddenCases} hidden) · ${row.points} pts`}
                                       {tab === 'bugs' && `${row.domain} · ${row.buggyLines} line${row.buggyLines === 1 ? '' : 's'} to fix · ${row.points} pts`}
                                       {tab === 'contests' && `${row.problemCount} problems · ${row.participantCount} registered · ${fmtDate(row.startTime)} → ${fmtDate(row.endTime)}`}
                                    </p>
                                 </div>

                                 {tab === 'problems' && (
                                    row.contestReady
                                       ? <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 size={14} /> Contest ready</span>
                                       // The single most useful warning here: a problem with no hidden
                                       // cases can be passed by printing the expected output.
                                       : <span className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600" title="No hidden test cases — students can hardcode the visible answers"><AlertTriangle size={14} /> Needs hidden cases</span>
                                 )}

                                 {tab === 'contests' && (
                                    <span className={`text-xs px-2.5 py-1 rounded-lg border ${row.status === 'Ongoing' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                       : row.status === 'Upcoming' ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                          : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                       {row.status}
                                    </span>
                                 )}

                                 {row.difficulty && (
                                    <span className={`text-xs px-2.5 py-1 rounded-lg border ${DIFF_STYLE[row.difficulty] ?? ''}`}>{row.difficulty}</span>
                                 )}

                                 {tab === 'contests' && (
                                    <button onClick={() => navigate(`/arena/contest/${row._id}`)} className="text-slate-300 hover:text-slate-900 transition-colors">
                                       <ChevronRight size={18} />
                                    </button>
                                 )}
                              </div>
                           ))}
                        </motion.div>
                     </AnimatePresence>
                  )}

                  {pages > 1 && (
                     <div className="flex items-center justify-center gap-4 mt-6">
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                           className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
                           <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-slate-400 tabular-nums">Page {page} of {pages}</span>
                        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                           className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50">
                           <ChevronRight size={16} />
                        </button>
                     </div>
                  )}
               </div>
            </div>

            <p className="text-xs text-slate-300 mt-8 flex items-center gap-2">
               <Calendar size={13} /> Weekly contests are created automatically every Sunday, 9:00–12:00.
            </p>
         </div>
      </div>
   );
};

export default ArenaAdminDashboard;
