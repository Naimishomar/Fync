import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Copy, Swords, LogOut, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';

/**
 * Group challenge: two teams of two get the same problem, first team to an
 * accepted submission wins. Both members are pulled into the match room, so
 * either one can press Find Match.
 */
const TeamArena: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching'>('idle');
  const [socket, setSocket] = useState<Socket | null>(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const loadTeam = async () => {
    const res = await axios.get(`${API_URL}/arena/teams/mine`, auth);
    setTeam(res.data.team);
    setReady(res.data.ready);
    return res.data.team;
  };

  useEffect(() => {
    if (!authLoading && !token) { navigate('/login'); return; }
    if (token) loadTeam().catch(() => void 0);
  }, [token, authLoading]);

  // The socket is only useful once a team exists, and it has to rejoin the team
  // room on every connect so a match started by the partner still arrives here.
  useEffect(() => {
    if (!token || !team?._id || !user) return;
    const s = io(API_URL, { auth: { token }, transports: ['websocket'] });

    s.on('connect', () => s.emit('join_team_room', { teamId: team._id, userId: user._id }));
    s.on('searching_opponent', () => setStatus('searching'));
    s.on('coding_match_cancelled', () => setStatus('idle'));
    s.on('team_match_found', (data) => navigate(`/arena/match/${data.matchRoomId}`));
    s.on('battle_error', (e) => { setError(e.message); setStatus('idle'); });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [token, team?._id, user?._id]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await loadTeam();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const findMatch = () => {
    if (!socket || !team) return;
    setError('');
    socket.emit('find_team_match', { teamId: team._id, userId: user._id, difficulty: 'medium' });
  };

  const cancel = () => {
    socket?.emit('cancel_team_match', { teamId: team._id, difficulty: 'medium' });
    setStatus('idle');
  };

  const copy = () => {
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pt-25 pb-20">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-4 leading-none">Team battle</h1>
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em]">
            Two coders per side. Same problem. First team to solve it takes the match.
          </p>
        </header>

        {error && <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-6">{error}</p>}

        <AnimatePresence mode="wait">
          {!team ? (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-xl shadow-slate-200/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Form a squad</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Squad name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium outline-none mb-4"
                />
                <button
                  onClick={() => act(() => axios.post(`${API_URL}/arena/teams`, { name }, auth))}
                  disabled={busy || !name.trim()}
                  className="w-full bg-zinc-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-40"
                >
                  Create
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-xl shadow-slate-200/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Join a squad</p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Invite code"
                  maxLength={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-mono tracking-[0.3em] outline-none mb-4"
                />
                <button
                  onClick={() => act(() => axios.post(`${API_URL}/arena/teams/join`, { code }, auth))}
                  disabled={busy || code.length !== 6}
                  className="w-full bg-white border border-slate-900 py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="team" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-xl shadow-slate-200/50">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">{team.name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    {ready ? 'Full squad — ready to queue' : 'Waiting for a partner'}
                  </p>
                </div>
                <button
                  onClick={copy}
                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-mono tracking-[0.2em] active:scale-95 transition-transform"
                >
                  {team.inviteCode}
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-slate-400" />}
                </button>
              </div>

              <div className="space-y-3 mb-8">
                {[team.leader, ...(team.members ?? [])].filter(Boolean).map((m: any, i: number) => (
                  <div key={m._id ?? i} className="flex items-center gap-4 bg-slate-50 rounded-2xl p-4">
                    <img src={m.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png'} alt="" className="w-9 h-9 rounded-full object-cover" />
                    <p className="text-xs font-black uppercase tracking-tight">{m.username ?? 'Member'}</p>
                    {i === 0 && <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-slate-400">Leader</span>}
                  </div>
                ))}
                {!ready && (
                  <div className="flex items-center gap-4 border border-dashed border-slate-200 rounded-2xl p-4">
                    <Users size={18} className="text-slate-300" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Empty seat — share the code</p>
                  </div>
                )}
              </div>

              {status === 'searching' ? (
                <button onClick={cancel} className="w-full bg-slate-100 py-5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3">
                  <Loader2 size={16} className="animate-spin" /> Searching for a rival squad — cancel
                </button>
              ) : (
                <button
                  onClick={findMatch}
                  disabled={!ready}
                  className="w-full bg-zinc-900 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-30 flex items-center justify-center gap-3"
                >
                  <Swords size={16} /> Find match
                </button>
              )}

              <button
                onClick={() => act(() => axios.post(`${API_URL}/arena/teams/leave`, {}, auth))}
                disabled={busy}
                className="w-full mt-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={13} /> Leave squad
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TeamArena;
