import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Search, Download, ExternalLink, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';

interface Hit {
  source: string;
  id: string;
  ref: string;
  title: string;
  difficulty: string;
  tags: string[];
  rating?: number;
  url: string;
  statementAvailable?: boolean;
}

interface Draft {
  title: string;
  description: string;
  difficulty: string;
  tags: string[];
  testCases: { input: string; expectedOutput: string }[];
  constraints: string[];
  starterCode: Record<string, string>;
  sourceUrl: string;
}

const SOURCES = [
  { id: 'leetcode', label: 'LeetCode', note: 'Statement, samples & starter code' },
  { id: 'codeforces', label: 'Codeforces', note: 'Title & tags only — statement blocked' },
];

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-emerald-600 bg-emerald-50',
  Medium: 'text-amber-600 bg-amber-50',
  Hard: 'text-rose-600 bg-rose-50',
};

const ImportProblem: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const [source, setSource] = useState('leetcode');
  const [q, setQ] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Hit | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  // Keyed by `${source}:${id}` so a batch of imports shows which ones landed.
  const [imported, setImported] = useState<Record<string, string>>({});

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setError('');
    setSelected(null);
    setDraft(null);
    try {
      const res = await axios.get(`${API_URL}/arena/admin/external/search`, {
        ...auth,
        params: { source, q, difficulty, limit: 30 },
      });
      setHits(res.data.results);
      if (!res.data.results.length) setError('No problems matched that search.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const preview = async (hit: Hit) => {
    setSelected(hit);
    setDraft(null);
    setPreviewing(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/arena/admin/external/preview`, {
        ...auth,
        params: { source: hit.source, id: hit.id },
      });
      setDraft(res.data.draft);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not load that problem.');
    } finally {
      setPreviewing(false);
    }
  };

  const doImport = async () => {
    if (!selected) return;
    setImporting(true);
    setError('');
    try {
      const res = await axios.post(
        `${API_URL}/arena/admin/external/import`,
        { source: selected.source, id: selected.id },
        auth,
      );
      setImported((prev) => ({ ...prev, [`${selected.source}:${selected.id}`]: res.data.message }));
    } catch (err: any) {
      // A 409 means it is already in the bank, which is a result, not a failure.
      setError(err.response?.data?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const key = selected ? `${selected.source}:${selected.id}` : '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 pt-25 pb-20">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/arena/admin')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-12 group"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>

        <header className="mb-10">
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-4 leading-none">Import problems</h1>
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.3em]">
            Pick from public problem banks instead of authoring by hand.
          </p>
        </header>

        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 mb-10 flex gap-4">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <p className="text-xs text-amber-900 font-medium leading-relaxed">
            No public source publishes its <strong>hidden</strong> test cases — only the samples shown in the
            statement. An imported problem is judged on those samples alone until you add more, and a contest scored
            on 3 visible cases can be passed by hard-coding the answers. Treat imports as a filled-in draft, then
            add hidden cases before the contest goes live.
          </p>
        </div>

        <form onSubmit={search} className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-xl shadow-slate-200/50 mb-10">
          <div className="flex flex-wrap gap-3 mb-6">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setSource(s.id); setHits([]); setSelected(null); setDraft(null); }}
                className={`px-5 py-3 rounded-2xl text-left transition-all border ${
                  source === s.id
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400'
                }`}
              >
                <p className="text-xs font-black uppercase tracking-tight">{s.label}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${source === s.id ? 'text-white/50' : 'text-slate-400'}`}>
                  {s.note}
                </p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[240px] flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title or tag — e.g. binary search"
                className="flex-1 bg-transparent py-4 text-sm font-medium outline-none"
              />
            </div>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-5 text-sm font-bold outline-none"
            >
              <option value="">Any difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <button
              type="submit"
              disabled={searching}
              className="bg-zinc-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-2"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : null}
              Search
            </button>
          </div>
        </form>

        {error && (
          <p className="text-rose-600 text-xs font-bold uppercase tracking-widest mb-6">{error}</p>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-3">
            {hits.map((hit) => {
              const done = imported[`${hit.source}:${hit.id}`];
              return (
                <button
                  key={`${hit.source}:${hit.id}`}
                  onClick={() => preview(hit)}
                  className={`w-full text-left bg-white border rounded-3xl p-5 transition-all hover:border-slate-400 ${
                    selected?.id === hit.id ? 'border-zinc-900 shadow-md' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-black text-slate-400 tracking-widest">{hit.ref}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${DIFF_COLOR[hit.difficulty] ?? ''}`}>
                      {hit.difficulty}
                    </span>
                    {hit.rating ? <span className="text-[10px] font-bold text-slate-400">{hit.rating}</span> : null}
                    {done ? <Check size={14} className="text-emerald-600 ml-auto" /> : null}
                  </div>
                  <p className="font-black tracking-tight mb-2">{hit.title}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                    {hit.tags.slice(0, 4).join(' · ')}
                  </p>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-xl shadow-slate-200/50 h-fit lg:sticky lg:top-28"
              >
                <div className="flex items-start justify-between gap-4 mb-6">
                  <h2 className="text-2xl font-black tracking-tighter">{selected.title}</h2>
                  <a href={selected.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 shrink-0">
                    <ExternalLink size={16} />
                  </a>
                </div>

                {previewing && <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Fetching…</p>}

                {draft && (
                  <>
                    <pre className="whitespace-pre-wrap text-xs text-slate-600 leading-relaxed font-medium max-h-64 overflow-y-auto mb-6 font-sans">
                      {draft.description}
                    </pre>

                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                      Sample cases ({draft.testCases.length})
                    </p>
                    {draft.testCases.length === 0 ? (
                      <p className="text-xs text-rose-600 font-bold mb-6">
                        None available — you will need to add every test case yourself.
                      </p>
                    ) : (
                      <div className="space-y-2 mb-6">
                        {draft.testCases.map((tc, i) => (
                          <div key={i} className="bg-slate-50 rounded-2xl p-4 text-[11px] font-mono">
                            <p className="text-slate-500">in: {tc.input}</p>
                            <p className="text-slate-900">out: {tc.expectedOutput}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {draft.constraints.length > 0 && (
                      <ul className="text-[11px] text-slate-500 font-medium space-y-1 mb-6 list-disc pl-4">
                        {draft.constraints.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    )}

                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">
                      Starter code: {Object.keys(draft.starterCode).join(', ') || 'none'}
                    </p>

                    {imported[key] ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs font-bold text-emerald-800">
                        {imported[key]}
                      </div>
                    ) : (
                      <button
                        onClick={doImport}
                        disabled={importing}
                        className="w-full bg-zinc-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Import to problem bank
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ImportProblem;
