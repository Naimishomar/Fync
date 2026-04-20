import React from 'react';
import { motion } from 'framer-motion';
import { 
  User as UserIcon, 
  Mail, 
  MapPin, 
  Calendar, 
  BookOpen, 
  Trophy, 
  Zap, 
  Code, 
  Github, 
  Linkedin, 
  ChevronRight,
  Shield,
  Star,
  Award,
  ExternalLink,
  Target
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
  const { user, loading, token } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !token) {
    navigate('/login');
    return null;
  }

  const stats = [
    { label: 'CP Points', value: user.coins || 0, icon: <Zap className="text-amber-500" /> },
    { label: 'Arena Rating', value: user.codingRating || 1200, icon: <Target className="text-indigo-600" /> },
    { label: 'Missions', value: user.codingStats?.totalSolved || 0, icon: <Trophy className="text-pink-600" /> },
    { label: 'Fync Score', value: user.fyncScore || 0, icon: <Star className="text-emerald-500" /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-28 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Profile Header Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[48px] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden relative mb-10"
        >
          {/* Banner */}
          <div className="h-64 bg-slate-900 relative">
            <img 
              src={user.banner || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop'} 
              alt="Banner" 
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          </div>

          {/* Profile Info Overlay */}
          <div className="px-12 pb-12 -mt-24 relative z-10">
            <div className="flex flex-col md:flex-row items-end gap-10">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-48 h-48 rounded-[40px] border-8 border-white bg-white shadow-2xl overflow-hidden"
              >
                <img 
                  src={user.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png'} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                />
              </motion.div>
              
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-4 mb-2">
                  <span className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-indigo-200">
                    {user.fyncBadge || 'Newcomer'}
                  </span>
                  <span className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-slate-200">
                    {user.user_access || 'User'}
                  </span>
                </div>
                <h1 className="text-5xl font-black italic tracking-tighter uppercase text-slate-900 mb-2 leading-none">
                  {user.name}
                </h1>
                <p className="text-slate-400 font-black uppercase text-[11px] tracking-[0.4em]">
                  @{user.username || 'unknown_entity'}
                </p>
              </div>

              <div className="flex gap-4 pb-4">
                <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl active:scale-95">
                  Edit Profile
                </button>
                <button className="bg-white border-2 border-slate-100 p-4 rounded-2xl hover:border-indigo-600 transition-all shadow-lg active:scale-95 group">
                  <ExternalLink size={20} className="text-slate-400 group-hover:text-indigo-600" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Stats & Info */}
          <div className="lg:col-span-1 space-y-10">
            {/* Rapid Stats Grid */}
            <div className="grid grid-cols-2 gap-6">
              {stats.map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-xl shadow-slate-200/50"
                >
                  <div className="bg-slate-50 w-10 h-10 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
                    {stat.icon}
                  </div>
                  <p className="text-2xl font-black italic tracking-tighter text-slate-900 leading-none mb-1">{stat.value}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* About Node */}
            <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 border-b border-slate-100 pb-4">Commander Intel</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-medium mb-10">
                {user.about || "This user has not yet initialized their orbital briefing. A mysterious entity in the Fync ecosystem."}
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-5 text-slate-500">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"><Mail size={16} /></div>
                  <span className="text-xs font-bold">{user.email}</span>
                </div>
                <div className="flex items-center gap-5 text-slate-500">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"><MapPin size={16} /></div>
                  <span className="text-xs font-bold">{user.college || "Digital Space"}</span>
                </div>
                <div className="flex items-center gap-5 text-slate-500">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"><Calendar size={16} /></div>
                  <span className="text-xs font-bold capitalize">Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>

            {/* Social Terminals */}
            <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 border-b border-slate-100 pb-4">Neural Terminals</h3>
              <div className="grid grid-cols-1 gap-4">
                <a href={`https://github.com/${user.githubUsername || ''}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 group transition-all">
                  <div className="flex items-center gap-4">
                    <Github className="text-slate-400 group-hover:text-slate-900 transition-colors" size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">GitHub Portal</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-900" />
                </a>
                <a href={user.linkedIn || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 group transition-all">
                  <div className="flex items-center gap-4">
                    <Linkedin className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">LinkedIn Relay</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600" />
                </a>
              </div>
            </div>
          </div>

          {/* Middle & Right Column: Technical Intelligence */}
          <div className="lg:col-span-2 space-y-10">
            {/* Coding stats / Charts */}
            <div className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h3 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900 mb-1">Algorithmic Telemetry</h3>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Competitive programming matrix</p>
                </div>
                <Code size={32} className="text-slate-100" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'LeetCode', solved: user.codingStats?.leetcodeSolved || 0, rating: user.codingStats?.leetcodeRating || 0, color: 'hover:border-amber-500' },
                  { label: 'GeeksForGeeks', solved: user.codingStats?.gfgSolved || 0, rating: user.codingStats?.gfgRating || 0, color: 'hover:border-emerald-500' },
                  { label: 'CodeChef', solved: user.codingStats?.codechefSolved || 0, rating: user.codingStats?.codechefRating || 0, color: 'hover:border-rose-500' }
                ].map((plat, i) => (
                  <div key={i} className={`bg-slate-50 border border-slate-100 p-8 rounded-[32px] transition-all group ${plat.color}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">{plat.label}</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-3xl font-black italic tracking-tighter text-slate-900 leading-none">{plat.solved}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Problems Solved</p>
                      </div>
                      <div>
                        <p className="text-xl font-black italic tracking-tighter text-indigo-600 leading-none">{plat.rating}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Platform Rating</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Arsenal & Education */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 mb-10">
                  <div className="bg-slate-900 p-2.5 rounded-xl"><Shield size={18} className="text-white" /></div>
                  <h3 className="text-lg font-black italic tracking-tighter uppercase text-slate-900">Technical Arsenal</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(user.skills && user.skills.length > 0) ? user.skills.map((skill: string, i: number) => (
                    <span key={i} className="px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all cursor-default">
                      {skill}
                    </span>
                  )) : (
                    <p className="text-slate-400 text-xs italic">No skills documented in the neural bank.</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 mb-10">
                  <div className="bg-indigo-600 p-2.5 rounded-xl"><BookOpen size={18} className="text-white" /></div>
                  <h3 className="text-lg font-black italic tracking-tighter uppercase text-slate-900">Education Matrix</h3>
                </div>
                <div className="space-y-8">
                  <div className="relative pl-8 border-l-2 border-slate-100">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm" />
                    <div>
                      <p className="text-slate-900 font-black uppercase leading-tight text-sm">{user.college || "Academy Institution"}</p>
                      <p className="text-[10px] font-black uppercase tracking-tighter text-indigo-600 mt-1">{user.major || "Technical Major"} • Class of {user.graduationYear || 2026}</p>
                      <p className="text-xs font-medium text-slate-500 mt-2">{user.year ? `Current Academic Year: ${user.year}` : ""}</p>
                    </div>
                  </div>
                  {user.education && user.education.map((edu: any, i: number) => (
                     <div key={i} className="relative pl-8 border-l-2 border-slate-100">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 border-4 border-white shadow-sm" />
                        <div>
                          <p className="text-slate-900 font-black uppercase leading-tight text-sm">{edu.institution}</p>
                          <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400 mt-1">{edu.degree} • {edu.field}</p>
                        </div>
                     </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Achievement Timeline Teaser */}
            <div className="bg-slate-900 rounded-[48px] p-12 text-white relative overflow-hidden group shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                    <Award size={24} className="text-indigo-400" />
                  </div>
                  <button onClick={() => navigate('/arena')} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors">Launch Arena Protocol</button>
                </div>
                <h3 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Arena Dominance</h3>
                <p className="text-slate-400 text-sm max-w-lg mb-0 font-medium leading-relaxed">
                  Continue your algorithmic conquest and secure regional dominance. Your current percentile reflects elite performance in contemporary sectors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
