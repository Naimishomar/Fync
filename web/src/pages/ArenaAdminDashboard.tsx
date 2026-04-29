import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
   Plus,
   Database,
   Trophy,
   Layout,
   ChevronRight,
   Clock,
   ShieldCheck,
   Zap,
   BarChart3,
   Search,
   Bug
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ArenaAdminDashboard: React.FC = () => {
   const { token, loading: authLoading } = useAuth();
   const [activeTab, setActiveTab] = useState<'contests' | 'problems' | 'bugs' | 'stats'>('contests');
   const [stats, setStats] = useState<any>(null);
   const [problems, setProblems] = useState<any[]>([]);
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
         fetchData();
      }
   }, [token, authLoading]);

   const fetchData = async () => {
      setLoading(true);
      try {
         const [statsRes, problemsRes, bugsRes] = await Promise.all([
            axios.get(`${API_URL}/arena/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${API_URL}/arena/admin/problems`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${API_URL}/arena/admin/bug-problems`, { headers: { Authorization: `Bearer ${token}` } })
         ]);
         setStats(statsRes.data.stats);
         setProblems(problemsRes.data.problems);
         setBugs(bugsRes.data.bugs || []);
      } catch (err) {
         console.error('Failed to fetch tactical data');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pt-25">
         <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
               <div className="flex items-center gap-3 mb-4">
                  <div className="bg-pink-600/10 p-2 rounded-xl">
                     <ShieldCheck className="text-pink-600" size={24} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Mission Control Center</p>
               </div>
               <h1 className="text-5xl font-black  tracking-tighter uppercase mb-2">Arena Command</h1>
               <p className="text-slate-500 text-sm max-w-xl font-medium leading-relaxed">Architect new challenges, schedule global missions, and monitor player telemetry from the unified command interface.</p>
            </div>

            <div className="flex flex-wrap gap-4">
               <button
                  onClick={() => navigate('/arena/admin/create-problem')}
                  className="group bg-white border border-slate-200 hover:border-pink-500/50 px-6 py-4 rounded-3xl transition-all flex items-center gap-4 active:scale-95 shadow-sm hover:shadow-md"
               >
                  <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                     <Plus size={20} />
                  </div>
                  <div className="text-left">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Logic Problem</p>
                     <p className="text-xs font-black uppercase  tracking-tight text-slate-900">Architect</p>
                  </div>
               </button>

               <button
                  onClick={() => navigate('/arena/admin/create-bug')}
                  className="group bg-white border border-slate-200 hover:border-rose-500/50 px-6 py-4 rounded-3xl transition-all flex items-center gap-4 active:scale-95 shadow-sm hover:shadow-md"
               >
                  <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors">
                     <Bug size={20} />
                  </div>
                  <div className="text-left">
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bug Mission</p>
                     <p className="text-xs font-black uppercase  tracking-tight text-slate-900">Deploy</p>
                  </div>
               </button>

               <button
                  onClick={() => navigate('/arena/admin/create-contest')}
                  className="group bg-zinc-900 px-6 py-4 rounded-3xl transition-all flex items-center gap-4 active:scale-95 shadow-2xl shadow-zinc-900/20"
               >
                  <div className="bg-white/10 p-2 rounded-xl group-hover:bg-pink-600 transition-colors">
                     <Trophy size={20} className="text-white" />
                  </div>
                  <div className="text-left">
                     <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Contest</p>
                     <p className="text-xs font-black uppercase  tracking-tight text-white">Schedule</p>
                  </div>
               </button>
            </div>
         </header>

         {/* Stats Quick Strip */}
         <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            {[
               { label: 'Total Problems', value: stats?.totalProblems || '0', icon: Database, color: 'text-indigo-600', bg: 'bg-indigo-50' },
               { label: 'Detected Bugs', value: stats?.totalBugs || '0', icon: Bug, color: 'text-rose-600', bg: 'bg-rose-50' },
               { label: 'Scheduled Contests', value: stats?.totalContests || '0', icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' },
               { label: 'Ongoing Missions', value: stats?.ongoingContests || '0', icon: Zap, color: 'text-pink-600', bg: 'bg-pink-50' },
            ].map((stat, i) => (
               <div key={i} className="bg-white border border-slate-200 p-8 rounded-3xl flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`${stat.bg} p-4 rounded-2xl`}>
                     <stat.icon className={stat.color} size={32} />
                  </div>
                  <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                     <p className="text-2xl font-black  tracking-tighter uppercase">{stat.value}</p>
                  </div>
               </div>
            ))}
         </div>

         {/* Main Content Area */}
         <div className="max-w-7xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-xl shadow-slate-200/50">
               <div className="flex border-b border-slate-100 bg-slate-50/30">
                  {(['contests', 'problems', 'bugs', 'stats'] as const).map(tab => (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-10 py-8 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                           }`}
                     >
                        {tab === 'bugs' ? 'Bug Missions' : tab}
                        {activeTab === tab && (
                           <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-pink-600" />
                        )}
                     </button>
                  ))}
               </div>

               <div className="p-12">
                  <AnimatePresence mode="wait">
                     {activeTab === 'problems' && (
                        <motion.div
                           key="problems"
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: -10 }}
                        >
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                              {problems.map((prob, i) => (
                                 <div key={prob._id} className="bg-slate-50 border border-slate-100 p-8 rounded-[32px] hover:border-pink-600/30 transition-all group shadow-sm hover:shadow-xl hover:shadow-slate-200/50">
                                    <div className="flex items-center justify-between mb-6">
                                       <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${prob.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
                                             prob.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                          }`}>
                                          {prob.difficulty}
                                       </span>
                                       <div className="flex gap-2">
                                          <button className="p-2.5 bg-white border border-slate-100 hover:bg-white rounded-xl shadow-sm transition-all"><Layout size={14} className="text-slate-400 group-hover:text-pink-600" /></button>
                                       </div>
                                    </div>
                                    <h3 className="text-2xl font-black  tracking-tighter uppercase mb-2 group-hover:text-pink-600 transition-colors leading-tight">{prob.title}</h3>
                                    <p className="text-slate-400 text-[9px] mb-10 uppercase font-black tracking-[0.2em]">{prob.category} Protocol</p>

                                    <div className="flex items-center justify-between pt-8 border-t border-slate-200/50">
                                       <div className="flex items-center gap-3">
                                          <Database size={14} className="text-slate-300" />
                                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{prob.testCases?.length || 0} Vectors</span>
                                       </div>
                                       <button className="text-slate-300 hover:text-pink-600 transition-colors"><ChevronRight size={22} /></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </motion.div>
                     )}

                     {activeTab === 'bugs' && (
                        <motion.div
                           key="bugs"
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: -10 }}
                        >
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                              {bugs.map((bug) => (
                                 <div key={bug._id} className="bg-slate-50 border border-slate-100 p-8 rounded-[32px] hover:border-rose-600/30 transition-all group shadow-sm hover:shadow-xl hover:shadow-slate-200/50">
                                    <div className="flex items-center justify-between mb-6">
                                       <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${bug.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
                                             bug.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                          }`}>
                                          {bug.difficulty}
                                       </span>
                                       <div className="bg-rose-50 text-rose-600 p-2 rounded-xl border border-rose-100">
                                          <Bug size={14} />
                                       </div>
                                    </div>
                                    <h3 className="text-2xl font-black  tracking-tighter uppercase mb-2 group-hover:text-rose-600 transition-colors leading-tight">{bug.title}</h3>
                                    <p className="text-slate-400 text-[9px] mb-10 uppercase font-black tracking-[0.2em]">{bug.language} Sanitization</p>
                                    <div className="flex items-center justify-between pt-8 border-t border-slate-200/50">
                                       <div className="flex items-center gap-3">
                                          <Zap size={14} className="text-slate-300" />
                                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bug.testCases?.length || 0} Sanitization Vectors</span>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                              {bugs.length === 0 && (
                                 <div className="col-span-full py-20 text-center opacity-50">
                                    <Bug className="mx-auto mb-4 text-slate-200" size={48} />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No active infestations found</p>
                                 </div>
                              )}
                           </div>
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>
            </div>
         </div>
      </div>
   );
};

export default ArenaAdminDashboard;
