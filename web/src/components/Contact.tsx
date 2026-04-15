import { motion } from 'framer-motion';
import { Mail, ExternalLink } from 'lucide-react';

const Contact = () => {
  return (
    <section id="contact" className="py-24 px-4 md:px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-center lg:text-left"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-4 md:mb-6 text-slate-900 leading-tight">Get in Touch</h2>
            <p className="text-slate-500 text-base md:text-lg mb-8 md:mb-10 max-w-md mx-auto lg:mx-0 font-medium leading-relaxed">
              Have questions or want to collaborate? We'd love to hear from you. 
              Our team is always open to feedback and new opportunities.
            </p>
            
            <div className="flex flex-col items-center lg:items-start space-y-6 md:space-y-8">
              <a 
                href="mailto:contact@fync.app" 
                className="flex items-center gap-4 group w-fit"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-black group-hover:text-white transition-all shadow-sm">
                  <Mail className="w-6 h-6 md:w-7 md:h-7" />
                </div>
                <div className="text-left">
                  <p className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-wider">Email us at</p>
                  <p className="text-lg md:text-xl font-black text-slate-900">dev.fync@gmail.com</p>
                </div>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 relative"
          >

            <div className="absolute -top-6 -right-6 w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-xl rotate-12">
              <ExternalLink className="w-6 h-6 text-white" />
            </div>
            
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900 ml-1">Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900 ml-1">Email</label>
                  <input 
                    type="email" 
                    placeholder="john@example.com"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 ml-1">Message</label>
                <textarea 
                  rows={4}
                  placeholder="How can we help?"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-black transition-colors resize-none"
                />
              </div>
              <button className="w-full bg-black hover:bg-zinc-800 text-white font-bold py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98]">
                Send Message
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
