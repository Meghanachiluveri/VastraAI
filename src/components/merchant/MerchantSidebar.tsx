import React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Sparkles,
  Shirt,
  Settings,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface MerchantSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const MerchantSidebar: React.FC<MerchantSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'activity', label: 'AI Activity', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Shirt className="w-4 h-4" />, badge: 'Read-only' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, badge: 'Dev' },
  ];

  return (
    <aside className="w-full lg:w-64 bg-background-elevated border-b lg:border-b-0 lg:border-r border-[#E6E2DA] dark:border-[#3E443D] p-5 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between lg:block">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-lg text-text-primary tracking-tight">
                VASTRA<span className="text-[#8AA48A]">.AI</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#CFD8CF]/40 dark:bg-[#343833] text-[#4A5B4A] dark:text-[#8AA48A] text-[10px] font-semibold uppercase tracking-wider border border-[#8AA48A]/30">
                Merchant
              </span>
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5 hidden lg:block">
              Commerce Intelligence & Stylist Performance
            </p>
          </div>

          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary lg:hidden transition-colors"
          >
            <span>Storefront</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap lg:w-full ${
                  isActive
                    ? 'bg-[#CFD8CF]/30 dark:bg-[#343833] text-text-primary font-semibold border border-[#8AA48A]/30 shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-primary/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-[#4A5B4A] dark:text-[#8AA48A]' : 'text-text-secondary'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="hidden lg:block pt-6 border-t border-[#E6E2DA] dark:border-[#3E443D] space-y-3">
        <div className="p-3 rounded-xl bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8AA48A]" />
              Database
            </span>
            <span className="font-mono text-[10px] text-text-primary">SQLite WAL</span>
          </div>

          <div className="flex items-center justify-between text-text-secondary">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8AA48A]" />
              Razorpay
            </span>
            <span className="font-mono text-[10px] text-text-primary">Test Mode</span>
          </div>
        </div>

        <Link
          to="/"
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] text-xs text-text-secondary hover:text-text-primary hover:bg-background-primary transition-all"
        >
          <span>Return to Storefront</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </aside>
  );
};
