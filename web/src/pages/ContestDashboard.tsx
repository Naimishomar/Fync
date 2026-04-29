import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Trophy, Users, Swords, Clock, ChevronRight, Star, Target, Shield, Zap, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ContestDashboard: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const [contests, setContests] = useState<any[]>([]);
  const [archivedContests, setArchivedContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!authLoading && !token) {
      navigate('/login');
      return;
    }
    if (token) {
      fetchContests();
    }
  }, [token, authLoading]);

  const fetchContests = async () => {
    try {
      const [upcomingRes, archiveRes] = await Promise.all([
        axios.get(`${API_URL}/arena/contests`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/arena/contests/archive`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setContests(upcomingRes.data);
      setArchivedContests(archiveRes.data);
    } catch (err) {
      console.error('Failed to fetch contests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pt-25">
      {/* Hero Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Global Rank', value: `#${user?.codingStats?.totalSolved ? '154' : '---'}`, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Elo Rating', value: user?.codingRating || '1200', icon: Star, color: 'text-pink-500', bg: 'bg-pink-500/10' },
          { label: 'Solved Problems', value: user?.codingStats?.totalSolved || '0', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Contests Played', value: user?.contestHistory?.length || '0', icon: Shield, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white border border-slate-200 p-6 rounded-3xl relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`absolute top-0 right-0 p-8 ${stat.bg} rounded-bl-[100px] transition-transform group-hover:scale-110`}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black  tracking-tighter uppercase">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Contests Feed */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black  uppercase tracking-widest flex items-center gap-3">
              <Zap size={20} className="text-pink-600" /> {showArchive ? 'Mission Archive' : 'Scheduled Missions'}
            </h2>
            <button
              onClick={() => setShowArchive(!showArchive)}
              className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors border-b border-transparent hover:border-slate-900 pb-1"
            >
              {showArchive ? 'View Active Missions' : 'View Mission Archive'}
            </button>
          </div>

          <div className="space-y-6">
            {(!showArchive ? contests : archivedContests).length === 0 && !loading && (
              <div className="bg-white/50 border border-dashed border-slate-200 p-12 rounded-3xl text-center">
                <Clock size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  No {showArchive ? 'archived' : 'active'} missions detected in this sector
                </p>
                {!showArchive && archivedContests.length > 0 && (
                  <button
                    onClick={() => setShowArchive(true)}
                    className="mt-6 text-pink-600 font-black uppercase text-[10px] tracking-widest hover:text-pink-700 transition-colors"
                  >
                    Inspect Archive Records
                  </button>
                )}
              </div>
            )}

            {(!showArchive ? contests : archivedContests).map((contest, i) => (
              <motion.div
                key={contest._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-pink-500/50 transition-all group shadow-sm hover:shadow-xl hover:shadow-slate-200/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${contest.status === 'Ongoing' ? 'bg-pink-500/10 text-pink-600' :
                          contest.status === 'Upcoming' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {contest.status}
                      </span>
                      {contest.status === 'Upcoming' && (
                        <span className="text-slate-400 text-[10px] font-bold">Scheduled Mission</span>
                      )}
                    </div>
                    <h3 className="text-2xl font-black  tracking-tighter uppercase group-hover:text-pink-600 transition-colors">{contest.title}</h3>
                    <p className="text-slate-500 text-xs mt-2 line-clamp-1">{contest.description}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/arena/contest/${contest._id}`)}
                    className="bg-slate-50 p-4 rounded-2xl group-hover:bg-pink-600 group-hover:text-white transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                <div className="flex items-center gap-8 mt-8 pt-8 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-slate-300" />
                    <span className="text-[10px] font-black uppercase text-slate-400">{contest.participants?.length || 0} Registered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-slate-300" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Prize: {contest.prizePool || 'Glory'}</span>
                  </div>
                  <div className="flex -space-x-2 ml-auto">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white overflow-hidden shadow-sm" />
                    ))}
                    <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">+120</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: 1v1 and Team Lobby */}
        <div className="space-y-8">
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Instant Combat</h2>
            <div
              className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 rounded-3xl p-8 shadow-2xl shadow-indigo-500/20 relative overflow-hidden group cursor-pointer"
              onClick={() => navigate('/arena/matchmaking')}
            >
              <Swords size={64} className="absolute -bottom-4 -right-4 text-white/10 group-hover:scale-125 transition-transform" />
              <h3 className="text-xl font-black  tracking-tighter uppercase mb-2 text-white">1v1 Code Duel</h3>
              <p className="text-indigo-100 text-[10px] leading-relaxed mb-6 font-medium">Challenge a random user to a real-time coding race. Speed is everything.</p>
              <button className="bg-white text-indigo-900 w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-900/10">Find Match</button>
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Squad Protocols</h2>
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <h3 className="text-xl font-black  tracking-tighter uppercase mb-2">Team Contests</h3>
              <p className="text-slate-500 text-[10px] leading-relaxed mb-6">Form a squad of 4 and dominate the shared leaderboard. Collaborative problem solving.</p>
              <div className="space-y-3">
                <button className="w-full py-3 rounded-2xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">Create Team</button>
                <button className="w-full py-3 rounded-2xl border border-dashed border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Join Invitation</button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Bug Finder Protocol</h2>
            <div
              className="bg-white border border-slate-200 rounded-3xl p-6 relative group overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
              onClick={() => navigate('/arena/bugs')}
            >
              <div className="flex items-center gap-4">
                <div className="bg-rose-500/10 p-3 rounded-2xl">
                  <Zap size={20} className="text-rose-600" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Sanitize Mission</h4>
                  <p className="text-slate-500 text-[9px] font-bold">Fix 3 bugs to earn 50 CP</p>
                </div>
              </div>
            </div>
          </section>

          {user?.user_access === 'admin' && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest text-pink-600 mb-4 px-2">Mission Control HQ</h2>
              <div
                className="bg-white border border-pink-200 rounded-3xl p-8 relative group overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors shadow-2xl shadow-pink-500/5"
                onClick={() => navigate('/arena/admin')}
              >
                <ShieldCheck size={64} className="absolute -bottom-4 -right-4 text-pink-500/10 group-hover:scale-125 transition-transform" />
                <h3 className="text-xl font-black  tracking-tighter uppercase mb-2">Admin Command</h3>
                <p className="text-slate-500 text-[10px] leading-relaxed mb-6">Manage problem bank, schedule contests, and monitor system telemetry.</p>
                <button className="bg-pink-600 text-white w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-pink-600/20 active:scale-95 transition-all">Enter HQ</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};


export default ContestDashboard;
