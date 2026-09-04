import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Drawer } from '../common/Drawer';
import { useUIStore } from '../../stores/useUIStore';
import { useTheme } from '../../hooks/useTheme';
import { Sparkles, Sun, Moon, Laptop, ArrowRight } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { isMobileNavOpen, closeMobileNav } = useUIStore();
  const location = useLocation();
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  const links = [
    { label: 'Shop All', href: '/shop' },
    { label: 'Men', href: '/men' },
    { label: 'Women', href: '/women' },
    { label: 'New Arrivals', href: '/new-arrivals' },
    { label: 'Curated Archive', href: '/archive' },
  ];

  const handleLinkClick = () => {
    closeMobileNav();
  };

  return (
    <Drawer
      isOpen={isMobileNavOpen}
      onClose={closeMobileNav}
      side="left"
      width="sm"
      title="Vastra.AI"
    >
      <div className="flex flex-col h-full justify-between space-y-8">
        
        {/* Top Navigation Links */}
        <div className="space-y-6">
          
          {/* Shop With AI Banner */}
          <div className="p-4 rounded-2xl bg-[#CFD8CF]/60 dark:bg-[#343833] border border-[#8AA48A]/30 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[#4A5B4A] dark:text-[#8AA48A] font-medium text-xs tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
              <span>AI Fashion Stylist</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Describe what you're dressing for and let our AI stylist curate pieces from the catalog.
            </p>
            <a
              href="/agent"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#8AA48A] hover:text-[#758E75] uppercase tracking-editorial pt-1 cursor-pointer"
            >
              <span>Consult Stylist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Core Route Links */}
          <nav className="space-y-1">
            {links.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={handleLinkClick}
                  className={`block py-3 px-3 text-base font-serif transition-colors rounded-xl ${
                    isActive
                      ? 'text-[#8AA48A] font-semibold bg-surface'
                      : 'text-text-primary hover:text-[#8AA48A]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <Link
              to="/merchant"
              onClick={handleLinkClick}
              className={`flex items-center justify-between py-3 px-3 text-sm font-medium transition-colors rounded-xl border border-[#A95D5B]/30 ${
                location.pathname.startsWith('/merchant')
                  ? 'text-[#A95D5B] font-semibold bg-[#A95D5B]/10'
                  : 'text-text-secondary hover:text-[#A95D5B] hover:bg-[#A95D5B]/5'
              }`}
            >
              <span>Merchant Analytics Portal</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#A95D5B]/15 text-[#A95D5B] uppercase font-bold tracking-wider">
                BI
              </span>
            </Link>
          </nav>
        </div>

        {/* Bottom Utility Actions */}
        <div className="space-y-4 pt-6 border-t border-[#E6E2DA] dark:border-[#3E443D]">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-text-secondary font-medium">
              Theme Mode
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-xs font-medium text-text-primary px-3 py-1.5 rounded-full bg-surface border border-[#E6E2DA] dark:border-[#3E443D]"
            >
              {theme === 'system' ? (
                <>
                  <Laptop className="w-3.5 h-3.5" />
                  <span>System</span>
                </>
              ) : resolvedTheme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#F6F7F2]" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#2A2A2A]" />
                  <span>Light</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-2 text-xs text-text-secondary leading-relaxed">
            <p>Customer Concierge: +91 (800) 928-8721</p>
            <p>concierge@vastra.ai</p>
          </div>
        </div>

      </div>
    </Drawer>
  );
};
