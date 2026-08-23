import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
   Trophy,
   Users,
   Clock,
   ChevronRight,
   Zap,
   Shield,
   ChevronLeft,
   AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';

const ContestDetails: React.FC = () => {
   const { contestId } = useParams();
   const { token, user } = useAuth();
   const navigate = useNavigate();
   const [contest, setContest] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [timeLeft, setTimeLeft] = useState<string>('');
   const [isRegistered, setIsRegistered] = useState(false);
   const [hasEntered, setHasEntered] = useState(false);
   const [isEntering, setIsEntering] = useState(false);
   const [board, setBoard] = useState<any[]>([]);


   useEffect(() => {
      fetchContestDetails();
   }, [contestId, token]);

   // Standings come from the ranked endpoint rather than the contest document:
   // participants are stored in join order, so rendering them directly showed
   // whoever registered first at the top regardless of what they solved.
   useEffect(() => {
      if (!token || !contestId) return;
      const load = () => axios
         .get(`${API_URL}/arena/contests/${contestId}/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
         .then((res) => setBoard(res.data.rows ?? []))
         .catch(() => void 0);
      load();
      const poll = setInterval(load, 30000);
      return () => clearInterval(poll);
   }, [contestId, token]);

   useEffect(() => {
      if (contest) {
         const timer = setInterval(() => {
            calculateTimeLeft();
         }, 1000);
         return () => clearInterval(timer);
      }
   }, [contest]);

   const fetchContestDetails = async () => {
      try {
         const res = await axios.get(`${API_URL}/arena/contests/${contestId}`, {
            headers: { Authorization: `Bearer ${token}` }
         });
         setContest(res.data);
         // Check if current user is registered
         const registered = res.data.participants?.some((p: any) => (p.user?._id === user?.id || p.user === user?.id));
         const entered = res.data.participants?.some((p: any) => (p.user?._id === user?.id || p.user === user?.id) && p.enteredAt);
         setIsRegistered(registered);
         setHasEntered(entered);
      } catch (err) {
         console.error('Failed to fetch mission manifest');
      } finally {
         setLoading(false);
      }
   };

   const calculateTimeLeft = () => {
      if (!contest) return;
      const now = new Date().getTime();
      const start = new Date(contest.startTime).getTime();
      const end = new Date(contest.endTime).getTime();

      if (now < start) {
         const diff = start - now;
         setTimeLeft(`Starts in: ${formatDiff(diff)}`);
      } else if (now < end) {
         const diff = end - now;
         setTimeLeft(`Ends in: ${formatDiff(diff)}`);
      } else {
         setTimeLeft('Contest is over');
      }
   };

   const formatDiff = (ms: number) => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((ms % (1000 * 60)) / 1000);
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
   };

   const handleRegister = async () => {
      try {
         await axios.post(`${API_URL}/arena/contests/${contestId}/register`, {}, {
            headers: { Authorization: `Bearer ${token}` }
         });
         setIsRegistered(true);
         fetchContestDetails();
      } catch (err) {
         console.error('Registration failed');
      }
   };

   const handleEnter = async () => {
      setIsEntering(true);
      try {
         await axios.post(`${API_URL}/arena/contests/${contestId}/enter`, {}, {
            headers: { Authorization: `Bearer ${token}` }
         });
         setHasEntered(true);
         fetchContestDetails();
      } catch (err) {
         console.error('Entry failed');
      } finally {
         setIsEntering(false);
      }
   };

   if (loading) return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
         <div className="w-16 h-16 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
   );

   if (!contest) return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
         <AlertCircle size={80} className="text-slate-100 mb-8" />
         <h1 className="text-4xl font-black uppercase  tracking-tighter text-slate-900">Match not found</h1>
         <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-4">We could not find that contest.</p>
         <button onClick={() => navigate('/arena')} className="mt-12 bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">Back to dashboard</button>
      </div>
   );

   const isOngoing = contest.status === 'Ongoing';
   const isCompleted = contest.status === 'Completed';

   return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pt-25">
         <div className="max-w-7xl mx-auto">
            <button
               onClick={() => navigate('/arena')}
               className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-12 group"
            >
               <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
               <span className="text-[10px] font-black uppercase tracking-widest">Back to dashboard</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
               {/* Left Column: Problem */}
               <div className="lg:col-span-2">
                  <header className="mb-12">
                     <div className="flex items-center gap-4 mb-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isOngoing ? 'bg-pink-500/10 text-pink-600 animate-pulse' :
                              isCompleted ? 'bg-slate-200 text-slate-500' : 'bg-indigo-500/10 text-indigo-600'
                           }`}>
                           {contest.status} Protocol
                        </span>
                        <div className="flex items-center gap-2 text-slate-400">
                           <Clock size={14} />
                           <span className="text-[10px] font-black uppercase tracking-widest">{timeLeft}</span>
                        </div>
                     </div>
                     <h1 className="text-6xl font-black  tracking-tighter uppercase mb-6 leading-tight select-none">
                        <span className="text-slate-300">CONTEST</span><br />
                        <span className="text-slate-900">{contest.title}</span>
                     </h1>
                     <div className="bg-white border border-slate-200 rounded-[32px] p-10 shadow-xl shadow-slate-200/50">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Details</h2>
                        <p className="text-slate-600 text-lg leading-relaxed font-medium">{contest.description}</p>
                     </div>
                  </header>

                  <section>
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black  tracking-tighter uppercase flex items-center gap-3">
                           <Zap size={20} className="text-pink-600" /> Challenge Manifest
                        </h3>
                        <span className="text-[10px] font-black uppercase text-slate-300">{contest.problems?.length || 0} problems</span>
                     </div>

                     <div className="space-y-4">
                        {contest.problems?.map((prob: any, i: number) => (
                           <div
                              key={prob._id}
                              className={`bg-white border border-slate-200 rounded-3xl p-8 flex items-center justify-between group transition-all shadow-sm ${(hasEntered && isOngoing) || isCompleted ? 'cursor-pointer hover:border-pink-500/50 hover:shadow-xl hover:shadow-slate-200/50' : 'opacity-70 grayscale-0 pointer-events-none'
                                 }`}
                              onClick={() => {
                                 if ((hasEntered && isOngoing) || isCompleted) navigate(`/arena/problem/${prob._id}?contestId=${contestId}`);
                              }}
                           >
                              <div className="flex items-center gap-8">
                                 <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black  transition-all border border-slate-100 ${prob.isLocked ? 'text-slate-200' : 'text-slate-300 group-hover:text-pink-600 group-hover:bg-pink-50'
                                    }`}>
                                    {prob.isLocked ? <Shield size={18} /> : i + 1}
                                 </div>
                                 <div>
                                    <h4 className={`text-xl font-black  tracking-tighter uppercase transition-colors ${prob.isLocked ? 'text-slate-300' : 'group-hover:text-pink-600'
                                       }`}>{prob.title}</h4>
                                    <div className="flex items-center gap-4 mt-1">
                                       <span className={`text-[8px] font-black uppercase tracking-widest ${prob.difficulty === 'Easy' ? 'text-emerald-600' :
                                             prob.difficulty === 'Medium' ? 'text-amber-600' : 'text-rose-600'
                                          }`}>{prob.difficulty} Difficulty</span>
                                       {prob.isLocked && (
                                          <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Locked — start the contest to open this</span>
                                       )}
                                    </div>
                                 </div>
                              </div>
                              {((hasEntered && isOngoing) || isCompleted) && (
                                 <div className="bg-slate-50 text-slate-400 group-hover:bg-pink-600 group-hover:text-white p-4 rounded-2xl transition-all shadow-sm">
                                    <ChevronRight size={24} />
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                  </section>
               </div>

               {/* Right Column: Mission Ops */}
               <div className="space-y-8">
                  <section className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Contest at a glance</h3>
                     <div className="space-y-6 mb-12">
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-3">
                              <Users size={16} className="text-slate-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Registered</span>
                           </div>
                           <span className="text-sm font-black ">{contest.participants?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-3">
                              <Trophy size={16} className="text-slate-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Points</span>
                           </div>
                           <span className="text-sm font-black  text-pink-600">{contest.prizePool || 'Glory'}</span>
                        </div>
                     </div>

                     {!isRegistered && !isCompleted ? (
                        <button
                           onClick={handleRegister}
                           className="w-full bg-zinc-900 text-white py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-black hover:-translate-y-1"
                        >
                           Join Mission
                        </button>
                     ) : isOngoing && !hasEntered ? (
                        <div className="space-y-4">
                           <div className="p-8 bg-amber-50 border border-amber-100 rounded-[2rem] text-center">
                              <p className="text-amber-600 font-black uppercase text-[10px] tracking-widest mb-3">Contest is live</p>
                              <p className="text-sm text-slate-500 leading-relaxed">Press start to open the problems. Your time starts when you do.</p>
                           </div>
                           <button
                              onClick={handleEnter}
                              disabled={isEntering}
                              className="w-full bg-rose-600 text-white py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-rose-700 hover:-translate-y-1 animate-bounce"
                           >
                              {isEntering ? 'Initializing...' : 'Start contest'}
                           </button>
                        </div>
                     ) : isOngoing && hasEntered ? (
                        <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2rem] text-center">
                           <div className="flex items-center justify-center gap-2 mb-3">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <p className="text-emerald-600 font-black uppercase text-[10px] tracking-widest">You are in</p>
                           </div>
                           <p className="text-sm text-slate-500 leading-relaxed">Solve the problems below. Rank is by problems solved, then by total time.</p>
                        </div>
                     ) : isCompleted ? (
                        <div className="p-8 bg-slate-100 rounded-[2rem] text-center opacity-60">
                           <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Contest is over</p>
                        </div>
                     ) : (
                        <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2rem] text-center">
                           <p className="text-indigo-600 font-black uppercase text-[10px] tracking-widest mb-3">You are registered</p>
                           <p className="text-sm text-slate-500 leading-relaxed">It opens at the scheduled start time.</p>
                        </div>
                     )}
                  </section>

                  <section className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50 overflow-hidden relative">
                     <div className="flex items-center justify-between mb-10">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Leaderboard</h3>
                        <button className="text-[10px] font-black uppercase text-pink-600 border-b border-transparent hover:border-pink-600 pb-1">Archive</button>
                     </div>
                     <div className="space-y-6">
                        {board.slice(0, 10).map((row: any) => (
                           <div key={row.rank} className="flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                 <span className="text-[10px] font-black  text-slate-200 group-hover:text-slate-400 transition-colors">#{row.rank}</span>
                                 <Link to="/profile" className="w-9 h-9 rounded-full bg-slate-50 overflow-hidden border border-slate-100 shadow-sm hover:border-indigo-600 transition-all active:scale-95">
                                    <img
                                       src={row.user?.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png'}
                                       alt=""
                                       className="w-full h-full object-cover"
                                    />
                                 </Link>
                                 <div>
                                    <Link to="/profile" className="text-xs font-black uppercase tracking-tighter text-slate-600 hover:text-slate-900 transition-all block">
                                       {row.user?.username || 'Redacted'}
                                    </Link>
                                    {/* Penalty is the tiebreak, so it has to be visible or the
                                        ordering looks arbitrary when scores are equal. */}
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                                       {row.solvedCount} solved · {row.penalty} min
                                    </p>
                                 </div>
                              </div>
                              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 uppercase tracking-tighter">{row.score || 0} CP</span>
                           </div>
                        ))}
                        {board.length === 0 && (
                           <p className="text-[10px] font-bold text-slate-200 text-center py-6  uppercase tracking-widest">No one has solved anything yet</p>
                        )}
                     </div>
                  </section>
               </div>
            </div>
         </div>
      </div>
   );
};

export default ContestDetails;
