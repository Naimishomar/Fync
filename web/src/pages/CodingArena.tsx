import React, { useState, useEffect } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Play, Send, Terminal, ChevronRight, Layout, Moon, Sun, Clock, Zap, Bug, ShieldAlert, MonitorCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const CodingArena: React.FC = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const [problem, setProblem] = useState<any>(null);
  const [contest, setContest] = useState<any>(null);
  const [code, setCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'desc' | 'solution' | 'submissions'>('desc');
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('light');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const queryParams = new URLSearchParams(window.location.search);
  const contestId = queryParams.get('contestId');

  useEffect(() => {
    if (!authLoading && !token) {
      navigate('/login');
      return;
    }
    if (token) {
      fetchProblem();
      if (contestId) fetchContest();
    }
  }, [problemId, token, authLoading, contestId]);

  // Security: Prevent back button and unmanaged navigation
  useEffect(() => {
    if (!contestId) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Standard browser warning
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [contestId]);

  // Timer Logic
  useEffect(() => {
    if (!contest || !contestId) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(contest.endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        handleAutoSubmit();
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [contest, contestId]);

  const fetchContest = async () => {
    try {
      const res = await axios.get(`${API_URL}/arena/contests/${contestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContest(res.data);
    } catch (err) {
      console.error('Failed to fetch contest intel');
    }
  };

  const handleAutoSubmit = async () => {
    console.warn('MISSION CLOCK EXPIRED: Triggering Tactical Resolution');
    await handleSubmit('submit');
    setTimeout(() => navigate(`/arena/contest/${contestId}`), 2000);
  };

  const handleAbort = async () => {
    if (window.confirm("LEAVING ARENA: Your current solution will be auto-submitted and this attempt will end. Proceed?")) {
      await handleSubmit('submit');
      navigate(`/arena/contest/${contestId}`);
    }
  };

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / (1000 * 60));
    const secs = Math.floor((ms % (1000 * 60)) / 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchProblem = async () => {
    try {
      const isBug = window.location.pathname.includes('/arena/bug/');
      const endpoint = isBug ? `/arena/bug-problems/${problemId}` : `/arena/problems/${problemId}`;
      const query = contestId ? `?contestId=${contestId}` : '';

      const res = await axios.get(`${API_URL}${endpoint}${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const prob = res.data.problem;
      setProblem(prob);

      // If it's a bug mission, use buggyCode. Otherwise use starterCode.
      if (isBug) {
        setCode(prob.buggyCode || '// No Corrupt Logic Detected');
        setOriginalCode(prob.buggyCode || '// No Corrupt Logic Detected');
        setLanguage(prob.language || 'javascript');
      } else {
        setCode(prob.starterCode?.[language] || '// Start coding here...');
      }
    } catch (err) {
      console.error('Failed to fetch problem');
    }
  };

  const handleSubmit = async (type: 'run' | 'submit') => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/arena/problems/submit`, {
        problemId,
        code,
        language,
        languageId: getLanguageId(language),
        type
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(res.data.submission);
    } catch (err) {
      setResults({ status: 'Error', message: 'Evaluation failed' });
    } finally {
      setLoading(false);
    }
  };

  const getLanguageId = (lang: string) => {
    const ids: Record<string, number> = {
      'javascript': 63,
      'python': 71,
      'cpp': 54,
      'java': 62
    };
    return ids[lang] || 63;
  };

  if (!problem) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-black  uppercase text-[10px] tracking-widest mt-4">Initializing Arena...</p>
      </motion.div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Top Navigation */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-6">
          <div
            onClick={contestId ? handleAbort : () => navigate('/arena')}
            className="p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors text-slate-400 hover:text-slate-900 group"
          >
            <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-pink-600 p-2 rounded-xl shadow-lg shadow-pink-600/20">
              <Zap size={18} className="text-white" fill="white" />
            </div>
            <h1 className="text-base font-black  uppercase tracking-tighter">{problem.title}</h1>
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${problem.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
                problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}>
              {problem.difficulty}
            </span>
          </div>
          {timeLeft !== null && (
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 rounded-xl shadow-xl shadow-slate-900/10 ml-4">
              <Clock size={14} className="text-pink-500 animate-pulse" />
              <span className="text-[12px] font-black  text-white tracking-widest">{formatTime(timeLeft)}</span>
              <span className="text-[8px] font-black uppercase text-slate-500 ml-1">Mission Clock</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-pink-500/20 transition-all"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python 3</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
          <button onClick={() => setTheme(theme === 'vs-dark' ? 'light' : 'vs-dark')} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200">
            {theme === 'vs-dark' ? <Sun size={14} className="text-slate-600" /> : <Moon size={14} className="text-slate-600" />}
          </button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <button onClick={() => handleSubmit('run')} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">
            <Play size={14} fill="currentColor" /> Run
          </button>
          <button onClick={() => handleSubmit('submit')} disabled={loading} className="flex items-center gap-2 px-8 py-2.5 bg-pink-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-pink-600/30 hover:bg-pink-700 active:scale-95 transition-all">
            <Send size={14} fill="currentColor" /> Submit
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Problem Data */}
        <div className="w-[500px] border-r border-slate-200 flex flex-col bg-white shadow-2xl z-0">
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
            {(['desc', 'solution', 'submissions'] as const).map(tab => {
              const isBug = window.location.pathname.includes('/arena/bug/');
              let label: string = tab;
              if (tab === 'desc') label = isBug ? 'Sanitization Briefing' : 'Briefing';
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === tab ? 'text-pink-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-10">
            <AnimatePresence mode="wait">
              {activeTab === 'desc' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="prose prose-slate max-w-none"
                >
                  <div className="flex items-center gap-2 mb-8">
                    {problem.tags?.map((tag: string) => (
                      <span key={tag} className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500">#{tag}</span>
                    ))}
                    {window.location.pathname.includes('/arena/bug/') && (
                      <span className="bg-rose-100 border border-rose-200 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                        <Bug size={10} /> Corrupted Logic Detected
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-black  tracking-tighter mb-6 uppercase text-slate-900 leading-none">{problem.title}</h2>

                  {window.location.pathname.includes('/arena/bug/') && (
                    <div className="grid grid-cols-3 gap-6 mb-10">
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-[24px]">
                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-2">Anomalous Profile</p>
                        <p className="text-sm font-black  uppercase  uppercase text-rose-600">{problem.difficulty} Protocol</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-[24px]">
                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-2">Language Protocol</p>
                        <p className="text-sm font-black  uppercase text-indigo-600">{problem.language}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-[24px]">
                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-2">Corrupt Signature</p>
                        <p className="text-sm font-black  uppercase text-slate-900">{problemId?.substring(0, 8)}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white border-2 border-slate-100 rounded-[32px] p-8 mb-10 shadow-sm relative overflow-hidden group hover:border-indigo-600/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Terminal size={120} />
                    </div>
                    <p className="text-slate-600 leading-relaxed text-sm font-medium relative z-10">{problem.description}</p>
                  </div>

                  <div className="space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2">Intelligence Vectors</h4>
                    {problem.testCases?.filter((t: any) => !t.isHidden).map((tc: any, i: number) => (
                      <div key={i} className="bg-slate-50 rounded-[28px] p-8 border border-slate-100 shadow-sm hover:bg-white hover:border-indigo-600/10 transition-all">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                          <Layout size={14} /> Sanitization Case #{i + 1}
                        </h4>
                        <div className="space-y-6">
                          <div>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2 px-1">Input Signal</p>
                            <code className="block bg-white border border-slate-200 p-4 rounded-2xl text-indigo-600 font-mono text-sm shadow-sm">{tc.input}</code>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2 px-1">Expected Output</p>
                            <code className="block bg-slate-900 text-white p-4 rounded-2xl font-mono text-sm shadow-xl shadow-slate-900/20">{tc.expectedOutput}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Panel: Editor & Terminal */}
        <div className="flex-1 flex flex-col bg-white relative">
          <div className="flex-1 relative">
            {window.location.pathname.includes('/arena/bug/') && (
              <div className="absolute top-0 left-0 right-0 h-10 bg-rose-900 flex items-center justify-between px-8 z-20 shadow-2xl">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={14} className="text-rose-400 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-100">Sanitization Progress: Diagnostic Mode</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-[8px] font-black uppercase text-rose-300">Corrupted Logic Signal</span>
                  </div>
                  <div className="w-px h-4 bg-rose-800" />
                  <div className="flex items-center gap-2">
                    <MonitorCheck size={12} className="text-emerald-500" />
                    <span className="text-[8px] font-black uppercase text-emerald-400">Target Stabilization</span>
                  </div>
                </div>
              </div>
            )}

            {window.location.pathname.includes('/arena/bug/') ? (
              <DiffEditor
                height="100%"
                theme={theme}
                language={language}
                original={originalCode}
                modified={code}
                onMount={(editor) => {
                  // Capture the modified editor to sync state
                  const modifiedEditor = editor.getModifiedEditor();
                  modifiedEditor.onDidChangeModelContent(() => {
                    setCode(modifiedEditor.getValue());
                  });
                }}
                options={{
                  fontSize: 15,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  renderSideBySide: true,
                  readOnly: false,
                  originalEditable: false,
                  padding: { top: 48, bottom: 32 },
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  renderLineHighlight: 'all',
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  }
                }}
              />
            ) : (
              <Editor
                height="100%"
                theme={theme}
                language={language}
                value={code}
                onChange={(v) => setCode(v || '')}
                options={{
                  fontSize: 15,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  padding: { top: 32, bottom: 32 },
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  renderLineHighlight: 'all',
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  }
                }}
              />
            )}
          </div>

          {/* Terminal / Results */}
          <div className="h-[300px] bg-slate-50 border-t border-slate-200 flex flex-col shadow-2xl relative z-10">
            <div className="flex items-center justify-between px-8 py-3 bg-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-pink-600" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Analytic Telemetry</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Operational</span>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
              {!results && !loading && (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                  <Terminal size={64} className="text-slate-900 mb-4" />
                  <p className="text-[12px] font-black uppercase tracking-[0.4em]">Awaiting Solution Stream</p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-pink-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6 animate-pulse">Decompiling Bytecode...</p>
                </div>
              )}

              {results && !loading && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="flex items-center gap-6 mb-8">
                    <div className={`px-6 py-3 rounded-2xl border-2 flex items-center gap-4 shadow-xl ${results.status === 'Accepted' ? 'bg-emerald-50 border-emerald-500/20 shadow-emerald-500/10' : 'bg-rose-50 border-rose-500/20 shadow-rose-500/10'
                      }`}>
                      <div className={`w-3 h-3 rounded-full ${results.status === 'Accepted' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`} />
                      <span className={`text-sm font-black uppercase tracking-[0.1em] ${results.status === 'Accepted' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>{results.status}</span>
                    </div>
                    <div className="flex items-center gap-10">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-slate-300 mb-1">Compute Time</span>
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-indigo-500" />
                          <span className="text-xs font-black tracking-tighter text-slate-700">{results.executionTime}ms</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-slate-300 mb-1">Memory Matrix</span>
                        <div className="flex items-center gap-2">
                          <Layout size={14} className="text-indigo-500" />
                          <span className="text-xs font-black tracking-tighter text-slate-700">{results.memoryUsage}KB</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-slate-300 mb-1">Integrity Score</span>
                        <span className="text-xs font-black text-pink-600 uppercase tracking-tighter">
                          {results.passedCount} / {results.totalCount} PASSED
                        </span>
                      </div>
                    </div>
                  </div>

                  {results.errorOutput && (
                    <div className="mt-4">
                      <p className="text-[9px] font-black uppercase text-rose-500 mb-2 px-1">Error Diagnostics</p>
                      <pre className="bg-rose-50 border border-rose-100 p-6 rounded-2xl text-rose-700 font-mono text-sm overflow-x-auto shadow-inner">
                        {results.errorOutput}
                      </pre>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodingArena;
