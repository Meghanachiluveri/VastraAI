import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollElevation } from '../../hooks/useScrollElevation';
import { useTheme } from '../../hooks/useTheme';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/useUIStore';
import { AuthModal } from '../auth/AuthModal';
import {
  Search,
  Sparkles,
  ShoppingBag,
  Sun,
  Moon,
  Laptop,
  Menu,
  User,
  LogOut,
  Package,
  UserCheck,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';

export const Navbar: React.FC = () => {
  const isElevated = useScrollElevation(20);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  
  // Stores
  const itemCount = useCartStore((state) => state.getItemCount());
  const openCart = useCartStore((state) => state.openCart);
  const { isLoggedIn, user, logout } = useAuthStore();
  const { isMerchantLoggedIn } = useMerchantAuthStore();
  const { openSearch, openMobileNav } = useUIStore();

  // Auth Modal & Dropdown
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Shop', href: '/shop' },
    { label: 'Men', href: '/men' },
    { label: 'Women', href: '/women' },
    { label: 'New Arrivals', href: '/new-arrivals' },
    { label: 'Archive', href: '/archive' },
  ];

  const handleAccountClick = () => {
    if (!isLoggedIn) {
      setIsAuthOpen(true);
    } else {
      setIsUserMenuOpen(!isUserMenuOpen);
    }
  };

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-300',
          isElevated
            ? 'glass-panel border-b border-[#E6E2DA]/80 dark:border-[#3E443D]/80 shadow-soft'
            : 'bg-[#F6F7F2]/95 dark:bg-[#1F231F]/95 backdrop-blur-xs border-b border-[#E6E2DA]/40 dark:border-[#3E443D]/40'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Left: Mobile Menu & Brand Logo */}
            <div className="flex items-center gap-4">
              <button
                onClick={openMobileNav}
                aria-label="Open mobile navigation"
                className="lg:hidden p-2 -ml-2 text-[#2A2A2A] dark:text-[#F6F7F2] hover:text-[#8AA48A] transition-colors focus:outline-none"
              >
                <Menu className="w-6 h-6" />
              </button>

              <Link to="/" className="flex items-center group">
                <span className="text-2xl sm:text-3xl font-serif tracking-tight text-[#2A2A2A] dark:text-[#F6F7F2] transition-colors font-medium">
                  Vastra
                </span>
                <span className="text-xs sm:text-sm font-sans tracking-widest font-bold text-[#8AA48A] uppercase ml-0.5 relative top-[-1px]">
                  .AI
                </span>
              </Link>
            </div>

            {/* Center: Editorial Categories (Desktop) */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      'relative py-2 text-xs uppercase tracking-widest font-medium transition-colors',
                      isActive
                        ? 'text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold'
                        : 'text-text-secondary hover:text-[#8AA48A] dark:hover:text-[#8AA48A]'
                    )}
                  >
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavUnderline"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8AA48A]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions & Tools */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Search Trigger */}
              <button
                onClick={openSearch}
                aria-label="Search catalog"
                className="p-2.5 text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2] hover:bg-[#CFD8CF]/40 dark:hover:bg-surface-elevated rounded-full transition-all focus:outline-none"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Atelier AI Stylist CTA - Opens in a dedicated NEW TAB */}
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <a
                  href="/agent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-full bg-[#8AA48A]/10 hover:bg-[#8AA48A]/18 text-[#2A2A2A] dark:text-[#F6F7F2] border border-[#8AA48A]/35 dark:border-[#8AA48A]/45 hover:border-[#8AA48A]/60 text-[11px] font-sans font-medium uppercase tracking-[0.14em] transition-all duration-300 shadow-xs hover:shadow-subtle group cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#7B876F] dark:text-[#8AA48A] group-hover:text-[#5E6854] dark:group-hover:text-[#A0B092] transition-colors duration-300" />
                  <span>Shop with AI</span>
                  <ArrowRight className="w-3 h-3 text-[#7B876F] dark:text-[#8AA48A] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 hidden sm:inline" />
                </a>
              </motion.div>

              {/* Merchant Portal Quick Return (When Merchant is Authenticated) */}
              {isMerchantLoggedIn && (
                <Link
                  to="/merchant"
                  aria-label="Merchant Portal"
                  title="Merchant Portal"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#7B876F]/15 hover:bg-[#7B876F]/25 text-[#5E6854] dark:text-[#A0B092] border border-[#7B876F]/30 text-[11px] font-sans font-medium uppercase tracking-[0.12em] transition-all"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#6D856D] dark:text-[#8AA48A]" />
                  <span className="hidden sm:inline">Merchant</span>
                </Link>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                aria-label={`Toggle theme (Current: ${theme})`}
                title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
                className="p-2.5 text-[#2A2A2A] dark:text-[#F6F7F2] hover:text-[#8AA48A] hover:bg-[#CFD8CF]/40 dark:hover:bg-surface-elevated rounded-full transition-all focus:outline-none relative w-10 h-10 flex items-center justify-center"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {theme === 'system' ? (
                    <motion.div
                      key="system"
                      initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Laptop className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" />
                    </motion.div>
                  ) : resolvedTheme === 'dark' ? (
                    <motion.div
                      key="dark"
                      initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#F6F7F2]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="light"
                      initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-[#2A2A2A]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Account Dropdown or Trigger */}
              <div className="relative">
                <button
                  onClick={handleAccountClick}
                  aria-label={isLoggedIn ? `Account menu for ${user?.name}` : 'Open log in modal'}
                  className={cn(
                    'p-2.5 rounded-full transition-all focus:outline-none flex items-center gap-1.5',
                    isLoggedIn
                      ? 'bg-[#CFD8CF]/50 dark:bg-[#343833] text-[#2A2A2A] dark:text-[#F6F7F2] border border-[#8AA48A]/40'
                      : 'text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2] hover:bg-[#CFD8CF]/40 dark:hover:bg-surface-elevated'
                  )}
                >
                  {isLoggedIn ? (
                    <span className="w-5 h-5 rounded-full bg-[#8AA48A] text-[#2A2A2A] text-[10px] font-bold flex items-center justify-center font-mono">
                      {user?.name.charAt(0) || 'U'}
                    </span>
                  ) : (
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>

                {/* Logged-In Dropdown */}
                <AnimatePresence>
                  {isLoggedIn && isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 p-2 rounded-2xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] shadow-soft z-50 text-xs space-y-1"
                    >
                      <div className="p-2.5 border-b border-[#E6E2DA] dark:border-[#3E443D] space-y-0.5">
                        <p className="font-semibold text-text-primary truncate">{user?.name}</p>
                        <p className="text-[10px] text-text-secondary truncate">{user?.email}</p>
                      </div>

                      <button
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-surface-elevated text-text-primary transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#8AA48A]" />
                        <span>My account</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/orders');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-surface-elevated text-text-primary transition-colors"
                      >
                        <Package className="w-3.5 h-3.5 text-[#8AA48A]" />
                        <span>Orders & Provenance</span>
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors border-t border-[#E6E2DA] dark:border-[#3E443D] mt-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Cart Drawer Trigger */}
              <button
                onClick={openCart}
                aria-label={`Shopping Bag with ${itemCount} items`}
                className="relative p-2.5 text-[#2A2A2A] dark:text-[#F6F7F2] hover:text-[#8AA48A] hover:bg-[#CFD8CF]/40 dark:hover:bg-surface-elevated rounded-full transition-all focus:outline-none"
              >
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                <AnimatePresence>
                  {itemCount > 0 && (
                    <motion.span
                      key={itemCount}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#8AA48A] text-[#2A2A2A] text-[10px] font-bold flex items-center justify-center shadow-xs"
                    >
                      {itemCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
};
