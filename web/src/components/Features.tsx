import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Globe, Shield, Trophy, ShoppingCart, MessageSquare, Code, Layout, BarChart3 } from 'lucide-react';

const FEATURE_DATA = [
  {
    icon: <Globe className="w-6 h-6" />,
    title: "Professional Hub",
    description: "Built-in networking platform designed specifically for the creative and technical workforce."
  },
  {
    icon: <ShoppingCart className="w-6 h-6" />,
    title: "AI Marketplace",
    description: "Trade AI resources, GPU credits, and digital models in an OLX-style ecosystem."
  },
  {
    icon: <Trophy className="w-6 h-6" />,
    title: "Coding Battles",
    description: "Engage in 1v1 DSA contests and weekly battles to climb the global leaderboard."
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Gemini AI Feed",
    description: "State-of-the-art recommendation engine using AI to score and rank content by interest."
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Affiliate Store",
    description: "Integrated marketing system allowing creators to sell products directly within the app."
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Global Community",
    description: "Safe confession feeds and encrypted community channels for authentic interactions."
  },
  {
    icon: <Code className="w-6 h-6" />,
    title: "Career Accelerator",
    description: "AI-powered resume parsing and interview preparation tools to land your dream job."
  },
  {
    icon: <Layout className="w-6 h-6" />,
    title: "DevToots Feed",
    description: "Engaging short-video feed for technical tutorials and creative showcases."
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Arena Rankings",
    description: "Real-time points system and regional rankings for the ultimate competitive edge."
  }
];



const Features = () => {
  return (
    <section id="features" className="py-24 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            Powerful Features for <br />
            <span className="text-gradient">Modern Creators</span>
          </motion.h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Everything you need to grow your professional career and monetize your skills in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {FEATURE_DATA.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] glass hover:bg-white transition-all duration-500 border-slate-100 hover:border-slate-200 hover:shadow-2xl hover:shadow-slate-200/50"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 group-hover:bg-black group-hover:text-white transition-all shadow-sm">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>


      </div>
    </section>
  );
};

export default Features;
