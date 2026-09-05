import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';

const STORAGE_KEY = 'vastra_shop_with_ai_dismissed';

export const ShopWithAIPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Never show on AI agent, checkout, orders, or merchant pages
    const path = location.pathname;
    if (
      path.startsWith('/agent') ||
      path.startsWith('/checkout') ||
      path.startsWith('/orders') ||
      path.startsWith('/merchant')
    ) {
      setIsVisible(false);
      return;
    }

    // Check if dismissed in this session
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY);
      if (dismissed === 'true') {
        return;
      }
    } catch {
      // Ignore storage errors
    }

    // Subtle trigger: show after 10 seconds of storefront browsing
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
  };

  const handleShopWithAI = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    navigate('/agent');
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Shop with AI Assistant"
        className="fixed bottom-6 right-6 z-40 max-w-sm w-[calc(100vw-3rem)] p-5 rounded-2xl bg-[#FCFCF9] dark:bg-[#252924] border border-[#E6E2DA] dark:border-[#3E443D] shadow-xl backdrop-blur-md space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#7B876F] dark:text-[#8AA48A]">
            <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
            <span>Shop Smarter with Vastra AI</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-[#E6E2DA]/50 transition-colors"
            aria-label="Dismiss AI shopping prompt"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-serif text-text-primary font-normal">
            Not sure what to choose?
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed font-light">
            Tell our AI stylist what you're looking for and get bespoke personalized recommendations tailored to your style.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={handleShopWithAI}
            className="flex-1 text-xs justify-center py-2"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Shop with AI
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-xs text-text-secondary hover:text-text-primary py-2 px-3"
          >
            Maybe Later
          </Button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
