import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { useParams, useNavigate } from 'react-router-dom';
import { Swords, Zap, Terminal, Clock, Skull, Send, ShieldAlert, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
  java: 62,
};

const MatchRoom: React.FC = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [battle, setBattle] = useState<any>(null);
  const [code, setCode] = useState<string>('// Start coding here...');
  const [language, setLanguage] = useState<string>('javascript');
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('light');
  const [message, setMessage] = useState<string>('');
  const [result, setResult] = useState<{ passedCount: number; totalCount: number; isSuccess: boolean } | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const roomJoined = useRef(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!authLoading && !token) {
      navigate('/login');
      return;
    }
    if (!token || !roomId) return;

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      roomJoined.current = false;
      newSocket.emit('join_battle', roomId);
    });

    newSocket.on('battle_sync', (data) => {
      setBattle(data);
      setCode(data.problem?.starterCode?.[language] || '// Start coding here...');
    });

    newSocket.on('battle_error', (data) => {
      setFailed(data?.message || 'Failed to join battle');
    });

    newSocket.on('opponent_progress', () => void 0);

    newSocket.on('submission_result', (data) => {
      setResult({ passedCount: data.passedCount, totalCount: data.totalCount, isSuccess: data.isSuccess });
      setMessage(data.isSuccess ? 'ALL CASES PASSED — EXECUTION CLEAN' : 'EXECUTION DEFECT — WRONG ANSWER');
    });

    newSocket.on('battle_end', (data) => {
      setWinner(data.winnerId);
      setMessage(data.winnerId === (user?._id || user?.id) ? 'VICTORY — DOMINATION SECURED' : 'DEFEAT — RIVAL TAKES THE WIN');
    });

    newSocket.on('opponent_left', () => setOpponentLeft(true));
    newSocket.on('disconnect', () => setConnected(false));
    newSocket.on('connect_error', () => setFailed('Unable to establish secure uplink to Battle HQ'));

    setSocket(newSocket);
    return () => {
      newSocket.emit('leave_battle', roomId);
      newSocket.disconnect();
    };
  }, [token, authLoading, roomId]);

  const handleSubmit = () => {
    if (!socket || !user) return;
    setMessage('SUBMISSION PROCESSING...');
    setResult(null);
    socket.emit('submit_solution', {
      matchRoomId: roomId,
      userId: user._id || user.id,
      code,
      languageId: LANGUAGE_IDS[language] || 63,
    });
  };

  if (failed) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
        <div className="bg-white border border-slate-200 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl">
          <ShieldAlert size={40} className="text-rose-600" />
        </div>
        <h2 className="text-3xl font-black tracking-tighter uppercase mb-4 text-rose-600">Battle Room Unreachable</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">{failed}</p>
        <button onClick={() => navigate('/arena')} className="bg-slate-900 text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all">
          Return to Arena
        </button>
      </motion.div>
    </div>
  );

  if (!battle) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mt-4">Establishing Battle Uplink...</p>
      </motion.div>
    </div>
  );

  const problem = battle.problem;

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/arena')} className="p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors text-slate-400 hover:text-slate-900">
            <Skull size={20} />
          </button>
          <div className="bg-pink-600 p-2 rounded-xl shadow-lg shadow-pink-600/20">
            <Swords size={18} className="text-white" />
          </div>
          <h1 className="text-base font-black uppercase tracking-tighter">Live Duel</h1>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-xl shadow-xl">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[8px] font-black uppercase text-slate-300">{connected ? 'Uplink Stable' : 'Uplink Lost'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-pink-500/20"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python 3</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
          <button onClick={() => setTheme(theme === 'vs-dark' ? 'light' : 'vs-dark')} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200">
            <Zap size={14} className="text-slate-600" />
          </button>
          <button onClick={handleSubmit} className="flex items-center gap-2 px-8 py-2.5 bg-pink-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-pink-600/30 hover:bg-pink-700 active:scale-95 transition-all">
            <Send size={14} fill="currentColor" /> Deploy Solution
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[500px] border-r border-slate-200 flex flex-col bg-white shadow-2xl">
          <div className="flex-1 overflow-y-auto p-10">
            <div className="flex items-center gap-2 mb-8">
              {problem.tags?.map((tag: string) => (
                <span key={tag} className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500">#{tag}</span>
              ))}
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${problem.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' : problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                {problem.difficulty}
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tighter mb-6 uppercase text-slate-900 leading-none">{problem.title}</h2>

            <div className="grid grid-cols-3 gap-6 mb-10">
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-[24px]">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-2">Difficulty</p>
                <p className="text-sm font-black uppercase text-indigo-600">{problem.difficulty}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-[24px]">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-2">Mode</p>
                <p className="text-sm font-black uppercase text-rose-600">1v1 Combat</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-[24px]">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-2">Battle ID</p>
                <p className="text-sm font-black uppercase text-slate-900">{roomId?.substring(roomId.lastIndexOf(':') + 1)}</p>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-100 rounded-[32px] p-8 mb-10 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Terminal size={120} />
              </div>
              <p className="text-slate-600 leading-relaxed text-sm font-medium relative z-10">{problem.description}</p>
            </div>

            <div className="space-y-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2">Intelligence Vectors</h4>
              {problem.testCases?.filter((t: any) => !t.isHidden).map((tc: any, i: number) => (
                <div key={i} className="bg-slate-50 rounded-[28px] p-8 border border-slate-100 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Sanitization Case #{i + 1}</h4>
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
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white relative">
          <div className="flex-1 relative">
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
                cursorSmoothCaretAnimation: 'on',
                renderLineHighlight: 'all',
              }}
            />
          </div>

          <div className="h-[300px] bg-slate-50 border-t border-slate-200 flex flex-col shadow-2xl relative z-10">
            <div className="flex items-center justify-between px-8 py-3 bg-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-pink-600" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Combat Telemetry</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-indigo-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Live</span>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
              <AnimatePresence mode="wait">
                {winner ? (
                  <motion.div key="winner" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full">
                    <Trophy size={48} className="text-amber-500 mb-4" />
                    <p className={`text-2xl font-black uppercase tracking-tighter ${winner === (user?._id || user?.id) ? 'text-emerald-600' : 'text-rose-600'}`}>{message}</p>
                    <button onClick={() => navigate('/arena')} className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all">
                      Return to Arena
                    </button>
                  </motion.div>
                ) : opponentLeft ? (
                  <motion.div key="left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full">
                    <p className="text-xl font-black uppercase tracking-tighter text-slate-700">Opponent has fled the arena — Victory by default</p>
                  </motion.div>
                ) : (
                  <motion.div key="telemetry" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {message && (
                      <div className={`flex items-center gap-4 mb-6 px-6 py-3 rounded-2xl border-2 ${result?.isSuccess || winner ? 'bg-emerald-50 border-emerald-500/20' : 'bg-amber-50 border-amber-500/20'}`}>
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-black uppercase tracking-[0.1em] text-slate-700">{message}</span>
                      </div>
                    )}
                    {result && (
                      <div className="flex items-center gap-10">
                        <span className="text-xs font-black text-emerald-600 uppercase tracking-tighter">{result.passedCount} / {result.totalCount} PASSED</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Judge0 Evaluation</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchRoom;