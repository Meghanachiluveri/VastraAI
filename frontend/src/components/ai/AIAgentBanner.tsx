import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, MessageSquare, Grid, ShoppingBag } from 'lucide-react';

export const AIAgentBanner: React.FC = () => {
  const [inputQuery, setInputQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      navigate(`/agent?q=${encodeURIComponent(inputQuery.trim())}`);
    } else {
      navigate('/agent');
    }
  };

  const quickPrompts = [
    'Something elegant for a wedding',
    'Breathable linen for summer',
    'Build an outfit under ₹5,000',
    'Minimal black evening look',
  ];

  return (
    <section className="my-16 md:my-24 space-y-12">
      
      {/* Editorial Split Hero Discovery */}
      <div className="bg-[#FCFCF9] dark:bg-[#343833] rounded-3xl border border-[#E6E2DA] dark:border-[#3E443D] p-6 sm:p-10 lg:p-14 shadow-soft overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Conversational Invitation */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            
            {/* Small Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] border border-[#B2C4B2]/40 text-[#4A5B4A] dark:text-[#8AA48A] text-[11px] font-semibold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
              <span>VASTRA AI</span>
            </div>

            {/* Large Serif Heading */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-[#2A2A2A] dark:text-[#F6F7F2] leading-[1.12] tracking-tight">
              Your wardrobe, <br className="hidden sm:inline" />
              <span className="italic font-light text-[#8AA48A]">thoughtfully curated.</span>
            </h2>

            {/* Supporting Editorial Copy */}
            <p className="text-sm sm:text-base text-text-secondary dark:text-[#C8CDC5] font-light leading-relaxed max-w-xl">
              Tell me where you're going, what you love, or simply what you feel like wearing. 
              I'll find pieces from the Vastra collection that fit your style.
            </p>

            {/* Conversational Floating Input Box */}
            <form onSubmit={handleSearchSubmit} className="pt-2">
              <div className="relative flex items-center bg-[#F6F7F2] dark:bg-[#1F231F] p-2.5 pl-5 sm:pl-6 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] shadow-subtle focus-within:border-[#8AA48A] focus-within:ring-1 focus-within:ring-[#8AA48A] transition-all max-w-xl">
                <Sparkles className="w-4 h-4 text-[#8AA48A] flex-shrink-0 mr-3" />
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="What are you dressing for?"
                  className="w-full bg-transparent text-sm sm:text-base text-[#2A2A2A] dark:text-[#F6F7F2] placeholder-text-secondary/70 focus:outline-none pr-14"
                />
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  aria-label="Send to AI Stylist"
                  className="absolute right-2.5 w-11 h-11 rounded-full bg-[#8AA48A] text-[#2A2A2A] hover:bg-[#758E75] flex items-center justify-center shadow-sage transition-colors flex-shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </form>

            {/* Quick Suggestions */}
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] uppercase tracking-widest text-text-secondary font-semibold">
                TRY ASKING
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {quickPrompts.map((prompt) => (
                  <motion.button
                    key={prompt}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/agent?q=${encodeURIComponent(prompt)}`)}
                    className="text-xs px-4 py-2 rounded-full bg-[#CFD8CF]/70 dark:bg-[#3E443D] hover:bg-[#CFD8CF] text-[#2A2A2A] dark:text-[#F6F7F2] border border-[#B2C4B2]/30 dark:border-[#3E443D] transition-colors font-medium select-none"
                  >
                    "{prompt}"
                  </motion.button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Editorial Fashion Photography with Floating AI Label */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-elevated border border-[#E6E2DA]/80">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85"
                alt="Vastra Fashion Editorial"
                className="w-full h-full object-cover object-center"
              />
              
              {/* Subtle Gradient Veil */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A2A]/40 via-transparent to-transparent pointer-events-none" />

              {/* Floating Sage Label */}
              <div className="absolute top-4 right-4 bg-[#FCFCF9]/95 dark:bg-[#343833]/95 backdrop-blur-md px-4 py-2 rounded-full border border-[#8AA48A]/40 shadow-subtle flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
                <span className="text-[11px] font-semibold tracking-widest text-[#4A5B4A] dark:text-[#8AA48A] uppercase">
                  VASTRA AI STYLIST
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Editorial 3-Pillar Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Search Naturally */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] space-y-3 shadow-subtle hover:border-[#8AA48A]/50 transition-colors">
          <div className="w-11 h-11 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] flex items-center justify-center text-[#4A5B4A] dark:text-[#8AA48A]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold tracking-widest uppercase text-[#2A2A2A] dark:text-[#F6F7F2]">
            SEARCH NATURALLY
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-[#C8CDC5] leading-relaxed font-light">
            Describe an occasion, mood, fabric, colour or budget.
          </p>
        </div>

        {/* Card 2: Same Collection */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] space-y-3 shadow-subtle hover:border-[#8AA48A]/50 transition-colors">
          <div className="w-11 h-11 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] flex items-center justify-center text-[#4A5B4A] dark:text-[#8AA48A]">
            <Grid className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold tracking-widest uppercase text-[#2A2A2A] dark:text-[#F6F7F2]">
            SAME COLLECTION
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-[#C8CDC5] leading-relaxed font-light">
            AI recommendations come from the same collection you can browse yourself.
          </p>
        </div>

        {/* Card 3: One Shared Bag */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] space-y-3 shadow-subtle hover:border-[#8AA48A]/50 transition-colors">
          <div className="w-11 h-11 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] flex items-center justify-center text-[#4A5B4A] dark:text-[#8AA48A]">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold tracking-widest uppercase text-[#2A2A2A] dark:text-[#F6F7F2]">
            ONE SHARED BAG
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-[#C8CDC5] leading-relaxed font-light">
            Anything the AI finds can be added to your normal shopping bag.
          </p>
        </div>

      </div>

    </section>
  );
};
