import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Users, Briefcase, Terminal, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import logo from '../assets/Fync.jpg';

/**
 * Web sign-in.
 *
 * Same design language as the app's login screen — Campus Press masthead, paper
 * sheet curving up over it, one stamped card — but laid out for a browser.
 *
 * Below `lg` it stacks exactly as the app does. From `lg` up the two halves sit
 * side by side and the sheet's curved seam turns vertical, because a 375px
 * column floating in the middle of a 1440px monitor is a phone screenshot, not
 * a web page. The devices are identical in both; only the axis changes.
 */

const PILLARS = [
  { icon: Users, label: 'Your campus' },
  { icon: Briefcase, label: 'Your career' },
  { icon: Terminal, label: 'Your craft' },
];

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/user/login', {
        // The API matches this against email, username, mobile number and work
        // email alike — the field was typed `email`, so a username could never
        // be submitted from the web even though the app allows one.
        email: identifier,
        password,
        deviceId: 'web-session',
        deviceModel: 'Web Browser',
      });

      if (res.data.success) {
        login(res.data.token, res.data.user);
        navigate('/arena');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not sign in. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex flex-col lg:flex-row lg:items-stretch">

      {/* Masthead. Drawn in type, like the app's — nothing to fetch on the one
          screen that has to render before anyone is signed in. */}
      <div className="bg-ink px-5 pt-8 pb-6 lg:flex-1 lg:flex lg:flex-col lg:justify-center lg:px-16 xl:px-24 lg:py-20 lg:min-h-screen">
        <div className="w-full max-w-xl lg:mx-auto">
          <div className="flex items-center gap-2 mb-5 lg:mb-8 opacity-85">
            <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
            <p className="font-display text-[9px] lg:text-[11px] uppercase text-paper" style={{ letterSpacing: '1.6px' }}>
              Est. on campus · Students only · Verified by college
            </p>
          </div>

          <div className="flex items-start gap-3 lg:gap-8">
            <div className="flex-1">
              <h1 className="font-display uppercase text-white text-[40px] leading-[40px] lg:text-[72px] lg:leading-[68px]" style={{ letterSpacing: '-1.8px' }}>
                One app
              </h1>
              <h1 className="font-display uppercase text-brand text-[40px] leading-[40px] lg:text-[72px] lg:leading-[68px]" style={{ letterSpacing: '-1.8px' }}>
                for college
              </h1>
              <p className="text-paper/90 text-[13px] leading-[19px] lg:text-[17px] lg:leading-[27px] mt-3 lg:mt-6 lg:max-w-md">
                Everything your campus runs on, in one place.
              </p>
            </div>

            {/* The number stamp, rotated on the wrapper so the digits stay upright. */}
            <div className="shrink-0" style={{ transform: 'rotate(3deg)' }}>
              <div className="w-[62px] h-[62px] lg:w-[92px] lg:h-[92px] rounded-xl bg-brand border-2 border-white flex flex-col items-center justify-center">
                <span className="font-display text-ink text-[22px] leading-6 lg:text-[34px] lg:leading-9">46</span>
                <span className="font-display uppercase text-ink text-[7px] lg:text-[10px]" style={{ letterSpacing: '0.8px' }}>tools</span>
              </div>
            </div>
          </div>

          <div className="h-0.5 bg-white/20 mt-5 mb-4 lg:mt-10 lg:mb-6" />

          <div className="flex gap-2 lg:gap-3">
            {PILLARS.map((p) => (
              <div key={p.label} className="flex-1 flex items-center gap-1.5 lg:gap-2.5 rounded-xl px-2 py-2.5 lg:px-4 lg:py-3.5 bg-white/[0.07] border-[1.5px] border-white/15">
                <p.icon size={13} className="text-brand shrink-0 lg:hidden" />
                <p.icon size={17} className="text-brand shrink-0 hidden lg:block" />
                <span className="font-display uppercase text-paper text-[8.5px] lg:text-xs truncate" style={{ letterSpacing: '0.4px' }}>
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The paper sheet, pulled over the masthead so the two curve apart instead
          of meeting on a hard seam. Horizontal when stacked, vertical when side
          by side. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-paper rounded-t-[26px] -mt-[22px] pt-2 pb-8 flex-1
                   lg:rounded-t-none lg:rounded-l-[26px] lg:mt-0 lg:-ml-[22px] lg:pt-0
                   lg:flex-none lg:w-[520px] lg:shrink-0 lg:flex lg:flex-col lg:justify-center lg:py-20 lg:min-h-screen"
      >
        <div className="w-full lg:max-w-[400px] lg:mx-auto">
          <div className="px-5 pt-6 pb-2 mb-5 lg:px-0 lg:pt-0 lg:mb-8">
            {/* The logo carries its own stamp: an ink circle offset behind it,
                the same device the card below uses. */}
            <div className="relative w-[72px] h-[72px] mx-auto">
              <div className="absolute left-1 top-1 w-[72px] h-[72px] rounded-full bg-ink" />
              <img src={logo} alt="Fync" className="relative w-[72px] h-[72px] rounded-full border-2 border-ink object-cover" />
            </div>
            <h2 className="hidden lg:block font-display uppercase text-ink text-2xl text-center mt-6" style={{ letterSpacing: '-0.5px' }}>
              Sign in
            </h2>
          </div>

          <div className="px-5 lg:px-0">
            {/* One stamped card per screen. */}
            <div className="bg-card border-2 border-ink rounded-[20px] p-4 lg:p-6" style={{ boxShadow: '4px 4px 0 #12100E' }}>
              <form onSubmit={handleLogin}>
                <label htmlFor="identifier" className="font-display text-[11px] uppercase text-ink-2 block" style={{ letterSpacing: '1.4px' }}>
                  Email or username
                </label>
                <div className="mt-2 flex items-center border-[1.5px] border-ink bg-card px-4 rounded-md min-h-[50px] focus-within:border-brand transition-colors">
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="you@college.ac.in"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>

                <label htmlFor="password" className="font-display text-[11px] uppercase text-ink-2 block mt-4" style={{ letterSpacing: '1.4px' }}>
                  Password
                </label>
                <div className="mt-2 flex items-center gap-3 border-[1.5px] border-ink bg-card px-4 rounded-md min-h-[50px] focus-within:border-brand transition-colors">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="text-ink-3 hover:text-ink transition-colors shrink-0"
                  >
                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>

                {error && (
                  <p role="alert" className="mt-3 text-[13px] text-rose-600 leading-relaxed">{error}</p>
                )}

                {/* Primary sits inside a card, so it takes the brand fill and the
                    2px rule but drops the stamp — one stamp per screen. */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 min-h-[48px] bg-brand border-2 border-ink rounded-md font-display uppercase text-ink text-sm flex items-center justify-center disabled:opacity-60 active:translate-y-px transition-transform"
                  style={{ letterSpacing: '0.3px' }}
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                    : 'Login'}
                </button>

                <p className="mt-4 text-center text-[13px] text-ink-2">
                  Don’t have an account?{' '}
                  <span className="font-semibold text-ink">Sign up in the app</span>
                </p>
              </form>
            </div>
          </div>

          {/* Section rule: eyebrow, 2px hard rule to the edge. */}
          <div className="px-5 pt-6 lg:px-0 lg:pt-8">
            <div className="flex items-center gap-3 mb-3">
              <p className="font-display text-[11px] uppercase text-ink shrink-0" style={{ letterSpacing: '1.4px' }}>
                New here
              </p>
              <div className="flex-1 h-0.5 bg-ink/80" />
            </div>

            {/* Registration is app-only, so this is a route to the download page
                rather than the app's alumni and recruiter sign-up buttons. */}
            <button
              onClick={() => navigate('/download')}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-ink border-2 border-ink rounded-md hover:bg-ink/90 transition-colors"
            >
              <Smartphone size={15} className="text-paper" />
              <span className="font-display uppercase text-paper text-xs" style={{ letterSpacing: '0.3px' }}>
                Get the app to sign up
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
