import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Zap, Search, Shield, Users, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Matchmaking: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');
  const [timer, setTimer] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!authLoading && !token) {
      navigate('/login');
      return;
    }

    if (token) {
      const newSocket = io(API_URL, {
        auth: { token },
        transports: ['websocket']
      });

      setSocket(newSocket);

      newSocket.on('searching_opponent', () => setStatus('searching'));

      newSocket.on('coding_match_found', (data) => {
        setStatus('found');
        setOpponent(data);
        setTimeout(() => {
          navigate(`/arena/match/${data.matchRoomId}`);
        }, 3000);
      });

      newSocket.on('connect_error', () => setStatus('error'));

      return () => {
        newSocket.disconnect();
      };
    }
  }, [token, authLoading]);

  useEffect(() => {
    let interval: any;
    if (status === 'searching') {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const startSearch = () => {
    if (!socket || !user) return;
    socket.emit('find_coding_match', {
      userId: user._id,
      difficulty: 'medium'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.03),transparent)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-indigo-500/10 rounded-full blur-[160px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="text-center z-10"
          >
            <div className="bg-white p-10 rounded-[56px] border border-slate-200 mb-12 mx-auto w-fit shadow-2xl shadow-indigo-500/10">
              <Swords size={80} className="text-indigo-600" />
            </div>
            <h1 className="text-6xl font-black  tracking-tighter uppercase mb-4 leading-none">1v1 Combat Protocol</h1>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.4em] mb-14">Universal Matchmaking Service Activated</p>

            <button
              onClick={startSearch}
              className="bg-slate-900 text-white px-16 py-6 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-slate-900/20 hover:shadow-slate-900/40 transition-all hover:-translate-y-2 active:scale-95 hover:bg-black"
            >
              Initialize Search
            </button>
          </motion.div>
        )}

        {status === 'searching' && (
          <motion.div
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center z-10"
          >
            <div className="relative w-80 h-80 mb-14">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-[1px] border-dashed border-slate-200 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-6 border-[1px] border-slate-100 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="bg-pink-500 w-40 h-40 rounded-full absolute -inset-10 blur-2xl"
                  />
                  <div className="bg-white border border-slate-200 w-24 h-24 rounded-[32px] flex items-center justify-center shadow-2xl relative z-10">
                    <Search size={36} className="text-pink-600 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-slate-400 font-black  uppercase text-[11px] tracking-[0.2em] mb-3">Scanning Neural Channels</p>
              <h2 className="text-4xl font-black  tracking-tighter uppercase mb-8 flex items-center gap-6 justify-center">
                Searching for Rival <span className="text-pink-600 tabular-nums">/{timer}s</span>
              </h2>

              <div className="flex gap-4 justify-center">
                {[0, 1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    animate={{ height: [6, 24, 6] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                    className="w-1.5 bg-pink-600/30 rounded-full"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setStatus('idle')}
              className="mt-16 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-rose-600 border-b-2 border-transparent hover:border-rose-600 pb-2 transition-all"
            >
              Abort Uplink
            </button>
          </motion.div>
        )}

        {status === 'found' && (
          <motion.div
            key="found"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center z-10"
          >
            <div className="flex items-center gap-16 mb-16 px-12 py-12 bg-white border border-slate-200 rounded-[64px] shadow-2xl shadow-indigo-500/10">
              <div className="bg-slate-50 border-2 border-indigo-500/20 w-36 h-36 rounded-[48px] flex items-center justify-center shadow-xl">
                <Shield size={48} className="text-indigo-600" />
              </div>
              <div className="flex flex-col items-center">
                <Zap size={40} className="text-amber-500 mb-3 animate-bounce" />
                <div className="px-5 py-2 bg-emerald-50 rounded-full">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ">SIGNAL LOCKED</p>
                </div>
              </div>
              <div className="bg-slate-50 border-2 border-pink-500/20 w-36 h-36 rounded-[48px] flex items-center justify-center shadow-xl">
                <Users size={48} className="text-pink-600" />
              </div>
            </div>

            <h2 className="text-6xl font-black  tracking-tighter uppercase text-center mb-8 leading-none">
              Launching Global Sync...
            </h2>
            <div className="w-80 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 3 }}
                className="h-full bg-gradient-to-r from-indigo-600 via-pink-600 to-indigo-600 bg-[length:200%_100%] animate-gradient-x"
              />
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center z-10"
          >
            <div className="bg-rose-50 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner border border-rose-100">
              <AlertCircle size={48} className="text-rose-600" />
            </div>
            <h2 className="text-3xl font-black  tracking-tighter uppercase mb-4 text-rose-600">Signal Corruption</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-12 max-w-xs mx-auto leading-relaxed">Unable to establish secure uplink to Matchmaking HQ. Check your network nodes and retry.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-900 text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all"
            >
              Retry Uplink
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Matchmaking;
