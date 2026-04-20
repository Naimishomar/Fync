import { motion } from 'framer-motion';
import { Swords, Trophy, Zap, ChevronRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const CodingArenaTeaser = () => {
    return (
        <section className="py-32 px-6 overflow-hidden bg-white relative">
            {/* Ambient Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px] bg-indigo-500/5 rounded-full blur-[160px] pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="flex items-center gap-4 mb-8">
                            <div className="bg-slate-900 p-3 rounded-2xl shadow-xl shadow-slate-900/10">
                                <Zap className="text-white w-6 h-6" fill="white" />
                            </div>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600 font-black uppercase text-[11px] tracking-[0.4em]">Neural Combat Protocol</span>
                        </div>

                        <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase text-slate-900 mb-10 leading-[0.85]">
                            Enter <br />
                            <span className="text-indigo-600">The Arena.</span>
                        </h2>

                        <p className="text-slate-500 text-xl mb-14 max-w-lg leading-relaxed font-medium">
                            Join the elite circle of developers. From weekly global contests to real-time 1v1 duels—sharpen your skills in a high-fidelity coding ecosystem built for builders.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-6">
                            <Link
                                to="/arena"
                                className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-4 shadow-2xl hover:bg-black hover:-translate-y-2 transition-all active:scale-95"
                            >
                                Launch Platform <ChevronRight size={16} />
                            </Link>
                            <Link
                                to="/arena/matchmaking"
                                className="bg-white border-2 border-slate-100 text-slate-900 px-10 py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-4 hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-slate-200/50"
                            >
                                <Swords size={20} className="text-indigo-600" /> Instant Duel
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        {/* Mock Code Interface */}
                        <div className="bg-white border border-slate-200 rounded-[56px] p-6 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.08)] relative overflow-hidden group">
                            <div className="flex items-center gap-3 mb-6 px-4">
                                <div className="w-3 h-3 rounded-full bg-rose-400" />
                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                <div className="ml-6 bg-slate-50 h-5 w-40 rounded-full border border-slate-100" />
                            </div>
                            
                            <div className="bg-slate-50 rounded-[32px] p-10 font-mono text-xs leading-relaxed relative overflow-hidden border border-slate-100 shadow-inner">
                                <span className="text-indigo-600 font-bold">const</span> <span className="text-rose-600">solveProblem</span> = (<span className="text-amber-600">signal</span>) =&gt; &#123; <br />
                                &nbsp;&nbsp;<span className="text-slate-300 italic">// Initialize global neural link...</span> <br />
                                &nbsp;&nbsp;<span className="text-indigo-600 font-bold">const</span> link = <span className="text-indigo-600">establishProtocol</span>(<span className="text-amber-600">'arena-v2'</span>); <br />
                                &nbsp;&nbsp;<span className="text-indigo-600 font-bold">return</span> link.<span className="text-indigo-600">execute</span>(signal); <br />
                                &#125;;
                                
                                <motion.div 
                                    animate={{ y: [0, 150, 0] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                    className="absolute top-0 right-0 left-0 h-32 bg-gradient-to-b from-transparent via-indigo-600/5 to-transparent pointer-events-none"
                                />
                            </div>

                            {/* Stats Overlay */}
                            <div className="absolute -bottom-8 -left-8 bg-indigo-600 text-white p-10 rounded-[4rem] shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 scale-90 md:scale-100">
                                <Trophy size={40} className="mb-3 text-indigo-100" />
                                <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-indigo-200 mb-1">Global Leaderboard</p>
                                <p className="text-4xl font-black italic tracking-tighter">RANKED #001</p>
                            </div>

                            <div className="absolute top-1/2 -right-6 bg-white border border-slate-100 p-8 rounded-[36px] shadow-2xl -rotate-6 group-hover:rotate-0 transition-all duration-500">
                                <div className="flex items-center gap-4">
                                   <div className="bg-emerald-50 p-2 rounded-xl">
                                    <Check size={20} className="text-emerald-600" strokeWidth={3} />
                                   </div>
                                   <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">ACCEPTED</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default CodingArenaTeaser;
