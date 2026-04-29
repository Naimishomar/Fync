import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/user/login`, {
        email,
        password,
        deviceId: 'web-session',
        deviceModel: 'Web Browser'
      });

      if (res.data.success) {
        login(res.data.token, res.data.user);
        navigate('/arena');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Establish uplink and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[160px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="text-center mb-12">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-900 w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-slate-900/20"
          >
            <Zap size={36} className="text-white" fill="white" />
          </motion.div>
          <h1 className="text-5xl font-black  tracking-tighter uppercase text-slate-900 leading-none">Arena Auth</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-4">Neural Link Identification Required</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[48px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block px-4">Identification Node</label>
              <div className="relative group">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                  type="email"
                  placeholder="EMAIL ADDRESS"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] py-5 pl-16 pr-8 text-xs font-black uppercase tracking-widest text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-inner placeholder:text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block px-4">Access Signature</label>
              <div className="relative group">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                  type="password"
                  placeholder="SECURE PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] py-5 pl-16 pr-8 text-xs font-black uppercase tracking-widest text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-inner placeholder:text-slate-200"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-50 border border-rose-100 p-5 rounded-2xl flex items-center gap-4 text-rose-600 text-[10px] font-black uppercase tracking-widest leading-relaxed"
              >
                <ShieldAlert size={18} /> {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-slate-900/10 hover:shadow-slate-900/30 hover:bg-black hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-4 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
              ) : (
                <>
                  Initialize Linking <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-12 text-slate-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
          New Explorer? <span className="text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors border-b border-transparent hover:border-indigo-800 pb-1">Download mobile app to register</span>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
