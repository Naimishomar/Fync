import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
   Plus,
   Trash2,
   Save,
   ChevronLeft,
   Code,
   Layout,
   Zap,
   Target,
   FlaskConical,
   Terminal,
   Bug,
   ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface TestCase {
   input: string;
   expectedOutput: string;
   isHidden: boolean;
}

const CreateBugMission: React.FC = () => {
   const { token } = useAuth();
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [success, setSuccess] = useState(false);

   // Mission State
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [difficulty, setDifficulty] = useState('Medium');
   const [language, setLanguage] = useState('javascript');
   const [points, setPoints] = useState(50);
   const [buggyCode, setBuggyCode] = useState('');

   // Test Cases
   const [testCases, setTestCases] = useState<TestCase[]>([
      { input: '', expectedOutput: '', isHidden: false }
   ]);

   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

   const addTestCase = () => {
      setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }]);
   };

   const removeTestCase = (index: number) => {
      setTestCases(testCases.filter((_, i) => i !== index));
   };

   const updateTestCase = (index: number, field: keyof TestCase, value: any) => {
      const updated = [...testCases];
      updated[index] = { ...updated[index], [field]: value };
      setTestCases(updated);
   };

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
         await axios.post(`${API_URL}/arena/admin/bug-problems`, {
            title,
            description,
            buggyCode,
            difficulty,
            language,
            testCases,
            points
         }, {
            headers: { Authorization: `Bearer ${token}` }
         });
         setSuccess(true);
         setTimeout(() => navigate('/arena/admin'), 2000);
      } catch (err) {
         console.error('Failed to save bug mission');
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
               <span className="text-[10px] font-black uppercase tracking-widest">Abort Sanitization Plan / Return to Command</span>
            </button>

            <header className="mb-12">
               <div className="flex items-center gap-4 mb-4">
                  <div className="bg-rose-600 p-2.5 rounded-2xl shadow-lg shadow-rose-200">
                     <Bug size={32} className="text-white" />
                  </div>
                  <div>
                     <h1 className="text-5xl font-black  tracking-tighter uppercase leading-none">Architect Bug Mission</h1>
                     <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em] mt-2">Deploy code-sanitation scenarios for arena solvers.</p>
                  </div>
               </div>
            </header>

            <form onSubmit={handleSave} className="space-y-12">
               {/* Section 1: Tactical Briefing */}
               <section className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-xl shadow-slate-200/50">
                  <div className="flex items-center gap-5 mb-12">
                     <div className="bg-indigo-50 p-4 rounded-3xl">
                        <ShieldAlert className="text-indigo-600" size={24} />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black  tracking-tighter uppercase">Tactical Briefing</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mission Core Intelligence</p>
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
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all font-bold placeholder:text-slate-300"
                              placeholder="e.g. Memory Leak in Neural Array"
                           />
                        </div>
                        <div className="flex gap-6">
                           <div className="flex-1">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Complexity</label>
                              <div className="relative">
                                 <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-rose-500 outline-none appearance-none font-black uppercase tracking-widest cursor-pointer"
                                 >
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                 </select>
                                 <Layout className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                              </div>
                           </div>
                           <div className="flex-1">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Bounty (CP)</label>
                              <input
                                 type="number"
                                 value={points}
                                 onChange={(e) => setPoints(Number(e.target.value))}
                                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-rose-500 outline-none font-black tracking-tighter"
                              />
                           </div>
                        </div>
                     </div>

                     <div className="space-y-8">
                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Runtime Protocol (Language)</label>
                           <div className="relative">
                              <select
                                 value={language}
                                 onChange={(e) => setLanguage(e.target.value)}
                                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-sm focus:border-rose-500 outline-none appearance-none font-black uppercase tracking-widest cursor-pointer"
                              >
                                 <option value="javascript">JavaScript</option>
                                 <option value="python">Python 3</option>
                                 <option value="cpp">C++</option>
                                 <option value="java">Java</option>
                              </select>
                              <Code className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                           </div>
                        </div>
                     </div>

                     <div className="col-span-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3 px-1">Problem Statement (Intelligence)</label>
                        <textarea
                           required
                           value={description}
                           onChange={(e) => setDescription(e.target.value)}
                           className="w-full h-40 bg-slate-50 border border-slate-200 rounded-[32px] px-8 py-7 text-sm focus:border-rose-500 outline-none transition-all font-medium leading-relaxed placeholder:text-slate-300 shadow-inner"
                           placeholder="Explain the buggy behavior that requires sanitization..."
                        />
                     </div>
                  </div>
               </section>

               {/* Section 2: Buggy Scaffolding */}
               <section className="bg-slate-900 border border-slate-800 rounded-[48px] p-12 shadow-2xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex items-center gap-5 mb-12 relative z-10">
                     <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                        <Terminal className="text-rose-400" size={24} />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black  tracking-tighter uppercase text-white">Neural Corruption (Buggy Code)</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">The codebase users must sanitize</p>
                     </div>
                  </div>

                  <div className="relative z-10">
                     <textarea
                        required
                        value={buggyCode}
                        onChange={(e) => setBuggyCode(e.target.value)}
                        className="w-full h-80 bg-black/40 border border-white/5 rounded-[32px] p-10 text-xs font-mono text-rose-400 focus:border-rose-500/50 outline-none transition-all shadow-2xl placeholder:text-slate-700"
                        placeholder="// Paste the corrupt code here... (e.g. a function with an off-by-one error)"
                     />
                     <div className="absolute right-8 bottom-8 flex items-center gap-3">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Corrupted Logic detected</span>
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                     </div>
                  </div>
               </section>

               {/* Section 3: Validation Vectors */}
               <section className="bg-white border border-slate-200 rounded-[48px] p-12 shadow-xl shadow-slate-200/50">
                  <div className="flex items-center justify-between mb-12">
                     <div className="flex items-center gap-5">
                        <div className="bg-rose-50 p-4 rounded-3xl">
                           <FlaskConical className="text-rose-600" size={24} />
                        </div>
                        <div>
                           <h2 className="text-2xl font-black  tracking-tighter uppercase">Sanitization Vectors</h2>
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Test Case Integrity Matrix</p>
                        </div>
                     </div>
                     <button
                        type="button"
                        onClick={addTestCase}
                        className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl active:scale-95"
                     >
                        <Plus size={16} /> Add Vector
                     </button>
                  </div>

                  <div className="space-y-8">
                     {testCases.map((tc, i) => (
                        <motion.div
                           key={i}
                           initial={{ opacity: 0, scale: 0.95 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="bg-slate-50 border border-slate-100 rounded-[36px] p-8 relative group shadow-sm"
                        >
                           <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4">
                                 <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-slate-900 shadow-sm border border-slate-100 ">{i + 1}</span>
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operational Vector</span>
                              </div>
                              <div className="flex items-center gap-8">
                                 <label className="flex items-center gap-3 cursor-pointer group/toggle">
                                    <input
                                       type="checkbox"
                                       checked={tc.isHidden}
                                       onChange={(e) => updateTestCase(i, 'isHidden', e.target.checked)}
                                       className="hidden"
                                    />
                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${tc.isHidden ? 'bg-rose-600 border-rose-600 shadow-lg shadow-rose-600/20' : 'border-slate-300 bg-white'}`}>
                                       {tc.isHidden && <Zap size={10} className="text-white" fill="white" />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/toggle:text-slate-900 transition-colors">Hidden Vector</span>
                                 </label>
                                 {testCases.length > 1 && (
                                    <button
                                       type="button"
                                       onClick={() => removeTestCase(i)}
                                       className="text-slate-300 hover:text-rose-600 transition-all p-2 hover:bg-rose-50 rounded-xl"
                                    >
                                       <Trash2 size={20} />
                                    </button>
                                 )}
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                 <p className="text-[9px] font-black uppercase text-slate-400 mb-3 px-1">Input Stream</p>
                                 <textarea
                                    value={tc.input}
                                    onChange={(e) => updateTestCase(i, 'input', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-3xl p-6 text-xs font-mono text-indigo-600 focus:border-rose-500 outline-none h-32 shadow-inner"
                                    placeholder="Input stream..."
                                 />
                              </div>
                              <div>
                                 <p className="text-[9px] font-black uppercase text-slate-400 mb-3 px-1">Corrective Output</p>
                                 <textarea
                                    value={tc.expectedOutput}
                                    onChange={(e) => updateTestCase(i, 'expectedOutput', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-3xl p-6 text-xs font-mono text-rose-600 focus:border-rose-500 outline-none h-32 shadow-inner"
                                    placeholder="Expected output signature..."
                                 />
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </div>
               </section>

               <footer className="flex items-center justify-end gap-10 pt-12 pb-20">
                  <button
                     type="button"
                     onClick={() => navigate('/arena/admin')}
                     className="text-slate-400 font-black uppercase text-[11px] tracking-[0.2em] hover:text-rose-600 transition-colors border-b-2 border-transparent hover:border-rose-600 pb-1"
                  >
                     Discard Mission Blueprint
                  </button>
                  <button
                     type="submit"
                     disabled={loading}
                     className="bg-zinc-900 text-white px-16 py-6 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-4 shadow-2xl shadow-rose-900/10 hover:bg-black hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
                  >
                     {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                     ) : (
                        <Save size={20} />
                     )}
                     Deploy Bug Mission
                  </button>
               </footer>
            </form>
         </div>

         <AnimatePresence>
            {success && (
               <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="fixed bottom-12 right-12 bg-white border border-emerald-100 p-8 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center gap-6 z-50 overflow-hidden"
               >
                  <div className="bg-emerald-500 p-4 rounded-2xl shadow-lg shadow-emerald-500/20">
                     <Zap size={24} className="text-white" fill="white" />
                  </div>
                  <div>
                     <p className="font-black uppercase text-[10px] tracking-widest text-emerald-600 mb-1">Sector Cleanse Initiated</p>
                     <p className="text-[11px] font-black uppercase  text-slate-900">Bug mission deployed successfully</p>
                  </div>
                  <motion.div
                     initial={{ width: '0%' }}
                     animate={{ width: '100%' }}
                     className="absolute bottom-0 left-0 h-1 bg-emerald-500"
                  />
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
};

export default CreateBugMission;
