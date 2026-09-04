import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { MobileNav } from './MobileNav';
import { SearchModal } from './SearchModal';
import { AIPromptModal } from '../ai/AIPromptModal';
import { QuickViewModal } from '../product/QuickViewModal';
import { ShopWithAIPrompt } from './ShopWithAIPrompt';
import { pageTransitionVariants } from '../../lib/motion';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const isAgentPage = location.pathname.startsWith('/agent');

  return (
    <div className={`flex flex-col ${isAgentPage ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-background text-text-primary selection:bg-[#8AA48A]/30 selection:text-text-primary`}>
      {/* Sticky Editorial Header */}
      <Navbar />

      {/* Main Content Area with Page Transitions */}
      <main className={`flex-1 ${isAgentPage ? 'flex flex-col overflow-hidden min-h-0' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={isAgentPage ? 'w-full h-full flex flex-col flex-1 min-h-0' : 'w-full'}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Editorial Footer - hidden on dedicated /agent screen */}
      {!isAgentPage && <Footer />}

      {/* Overlays, Drawers & Modals */}
      <CartDrawer />
      <MobileNav />
      <SearchModal />
      <AIPromptModal />
      <QuickViewModal />
      <ShopWithAIPrompt />
    </div>
  );
};
