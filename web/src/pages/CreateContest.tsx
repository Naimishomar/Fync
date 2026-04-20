import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Save, 
  ChevronLeft, 
  Trophy,
  Users,
  Clock,
  Layout,
  Globe,
  Lock,
  Zap,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CreateContest: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [problems, setProblems] = useState<any[]>([]);

  // Contest State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [visibility, setVisibility] = useState('Public');
  const [inviteCode, setInviteCode] = useState('');
  const [penalty, setPenalty] = useState(5);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    try {
      const res = await axios.get(`${API_URL}/arena/admin/problems`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProblems(res.data.problems);
    } catch (err) {
      console.error('Failed to fetch problem bank');
    }
  };

  const toggleProblem = (id: string) => {
    if (selectedProblems.includes(id)) {
      setSelectedProblems(selectedProblems.filter(p => p !== id));
    } else {
      setSelectedProblems([...selectedProblems, id]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/arena/admin/contests`, {
        title,
        description,
        problems: selectedProblems,
        startTime,
        endTime,
        prizePool,
        visibility,
        inviteCode: visibility === 'Private' ? inviteCode : null,
        penaltyPerWrongSubmission: penalty
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(true);
      setTimeout(() => navigate('/arena/admin'), 2000);
    } catch (err) {
      console.error('Failed to schedule mission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pt-25 pb-20">
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={() => navigate('/arena/admin')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-12 group"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Abort Launch / Return to Command</span>
        </button>

        <header className="mb-12">
          <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-4 leading-none">Initialize Mission</h1>
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em]">Schedule a new competitive contest and define operational parameters.</p>
        </header>

        <form onSubmit={handleSave} className="space-y-12">
          {/* Section 1: Contest Details */}
          <section className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-xl shadow-slate-200/50">
             <div className="flex items-center gap-5 mb-12">
                <div className="bg-amber-50 p-4 rounded-3xl">
                   <Trophy className="text-amber-600" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">Mission Briefing</h2>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tactical Deployment Parameters</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                   <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Mission Title</label>
                      <input 
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold placeholder:text-slate-300"
                        placeholder="e.g. Genesis Protocol 2024"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Prize Pool / Rewards</label>
                      <input 
                        value={prizePool}
                        onChange={(e) => setPrizePool(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold placeholder:text-slate-300"
                        placeholder="e.g. 5000 CP + Premium Badge"
                      />
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="grid grid-cols-2 gap-6">
                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Start Sequence</label>
                         <input 
                           type="datetime-local"
                           required
                           value={startTime}
                           onChange={(e) => setStartTime(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-amber-500 outline-none font-black text-[11px] uppercase"
                         />
                      </div>
                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">End Sequence</label>
                         <input 
                           type="datetime-local"
                           required
                           value={endTime}
                           onChange={(e) => setEndTime(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-amber-500 outline-none font-black text-[11px] uppercase"
                         />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-6">
                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Visibility Matrix</label>
                         <div className="relative">
                            <select 
                              value={visibility}
                              onChange={(e) => setVisibility(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-amber-500 outline-none appearance-none font-black uppercase tracking-widest cursor-pointer"
                            >
                               <option value="Public">Public Access</option>
                               <option value="Private">Invitation Only</option>
                            </select>
                            <Globe className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                         </div>
                      </div>
                      {visibility === 'Private' && (
                        <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Invite Code</label>
                         <input 
                           value={inviteCode}
                           onChange={(e) => setInviteCode(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-amber-500 outline-none font-black tracking-widest placeholder:text-slate-200"
                           placeholder="CODE_2024"
                         />
                        </div>
                      )}
                   </div>
                </div>

                <div className="col-span-full">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Mission Briefing (Description)</label>
                   <textarea 
                     required
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     className="w-full h-32 bg-slate-50 border border-slate-200 rounded-[32px] px-8 py-7 text-sm focus:border-amber-500 outline-none transition-all font-medium leading-relaxed placeholder:text-slate-300"
                     placeholder="Outline the mission objectives and rules..."
                   />
                </div>
             </div>
          </section>

          {/* Section 2: Problem Selection */}
          <section className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-xl shadow-slate-200/50">
             <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-5">
                   <div className="bg-indigo-50 p-4 rounded-3xl">
                      <Layout className="text-indigo-600" size={24} />
                   </div>
                   <div>
                     <h2 className="text-2xl font-black italic tracking-tighter uppercase">Challenge Selection ({selectedProblems.length})</h2>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Problem Bank Integrator</p>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {problems.map((prob) => (
                   <div 
                    key={prob._id}
                    onClick={() => toggleProblem(prob._id)}
                    className={`p-8 rounded-[40px] border-2 transition-all cursor-pointer flex items-center justify-between group shadow-sm ${
                      selectedProblems.includes(prob._id) 
                      ? 'bg-indigo-50 border-indigo-500 shadow-indigo-600/10' 
                      : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                   >
                      <div className="flex items-center gap-6">
                         <div className={`w-12 h-12 rounded-[20px] flex items-center justify-center transition-all ${
                            selectedProblems.includes(prob._id) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-50 text-slate-300 group-hover:text-slate-500 border border-slate-100'
                         }`}>
                            {selectedProblems.includes(prob._id) ? <Check size={20} strokeWidth={3} /> : <Plus size={20} />}
                         </div>
                         <div>
                            <h4 className="text-lg font-black italic tracking-tighter uppercase leading-tight">{prob.title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`text-[8px] font-black uppercase tracking-widest ${
                                prob.difficulty === 'Easy' ? 'text-emerald-600' : 
                                prob.difficulty === 'Medium' ? 'text-amber-600' : 'text-rose-600'
                              }`}>{prob.difficulty} Protocol</span>
                              <span className="text-slate-300 font-black text-[12px]">•</span>
                              <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">{prob.category}</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Bounty</span>
                        <span className="text-base font-black italic tracking-tighter text-indigo-600 leading-none">{prob.points} PT</span>
                      </div>
                   </div>
                ))}
             </div>
          </section>

          <footer className="flex items-center justify-end gap-10 pt-12">
             <button 
              type="button" 
              onClick={() => navigate('/arena/admin')}
              className="text-slate-400 font-black uppercase text-[11px] tracking-[0.2em] hover:text-rose-600 transition-colors border-b-2 border-transparent hover:border-rose-600 pb-1"
             >
                Abort Scrambling
             </button>
             <button 
              type="submit"
              disabled={loading || selectedProblems.length === 0}
              className="bg-slate-900 text-white px-16 py-6 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-4 shadow-2xl hover:bg-black hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
             >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                ) : (
                  <Zap size={20} />
                )}
                Launch Mission Pipeline
             </button>
          </footer>
        </form>
      </div>

      <AnimatePresence>
         {success && (
           <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-12 right-12 bg-white border border-amber-100 p-8 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center gap-6 z-50 overflow-hidden"
           >
              <div className="bg-amber-500 p-4 rounded-2xl shadow-lg shadow-amber-500/20">
                <Trophy size={24} className="text-white" fill="white" />
              </div>
              <div>
                 <p className="font-black uppercase text-[10px] tracking-widest text-amber-600 mb-1">Pipeline Operational</p>
                 <p className="text-[11px] font-black uppercase italic text-slate-900">Contest scheduled successfully</p>
              </div>
              <motion.div 
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                className="absolute bottom-0 left-0 h-1 bg-amber-500"
              />
           </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

export default CreateContest;
