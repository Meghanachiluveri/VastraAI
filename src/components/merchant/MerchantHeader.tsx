import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Sparkles, LogOut, Building2 } from 'lucide-react';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';

interface MerchantHeaderProps {
  selectedRange: 'today' | '7d' | '30d' | 'all';
  onRangeChange: (range: 'today' | '7d' | '30d' | 'all') => void;
  onRefresh: () => void;
  onOpenSimulationModal: () => void;
  isLoading: boolean;
}

export const MerchantHeader: React.FC<MerchantHeaderProps> = ({
  selectedRange,
  onRangeChange,
  onRefresh,
  onOpenSimulationModal,
  isLoading,
}) => {
  const navigate = useNavigate();
  const { merchant, logout } = useMerchantAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/merchant/login', { replace: true });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const ranges: { id: 'today' | '7d' | '30d' | 'all'; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 days' },
    { id: '30d', label: 'Last 30 days' },
    { id: 'all', label: 'All time' },
  ];

  return (
    <div className="space-y-4 pb-6 border-b border-[#E6E2DA] dark:border-[#3E443D]">
      {/* Top Merchant Identity & Logout Bar */}
      <div className="flex items-center justify-between py-1 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#A95D5B]/15 text-[#A95D5B] flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-text-primary">
                {merchant?.name || 'Vastra Atelier Store'}
              </span>
              <span className="px-2 py-0.2 rounded-full bg-[#7B876F]/15 text-[#7B876F] text-[10px] font-bold uppercase tracking-wider">
                Merchant
              </span>
            </div>
            <span className="text-[11px] text-text-secondary">
              {merchant?.email || 'merchant@vastra.ai'}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 transition-colors font-medium text-xs"
          title="Sign out of Merchant Portal"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>

      {/* Main Greeting & Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary font-display tracking-tight">
              {getGreeting()}, {merchant?.name?.split(' ')[0] || 'Merchant'}
            </h1>
            <span className="p-1 rounded-md bg-[#CFD8CF]/40 dark:bg-[#343833] text-[#4A5B4A] dark:text-[#8AA48A]">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Here's how your commerce channels and AI concierge are performing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector Pills */}
          <div className="flex items-center gap-1 p-1 bg-background-elevated rounded-xl border border-[#E6E2DA] dark:border-[#3E443D]">
            {ranges.map((r) => (
              <button
                key={r.id}
                onClick={() => onRangeChange(r.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  selectedRange === r.id
                    ? 'bg-background-primary text-text-primary shadow-xs font-semibold border border-[#E6E2DA] dark:border-[#3E443D]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Refresh Action Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:text-text-primary hover:bg-background-primary transition-all disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#8AA48A]' : ''}`} />
          </button>

          {/* Run Simulation Luxury Action Button */}
          <button
            onClick={onOpenSimulationModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8AA48A] text-[#2A2A2A] text-xs font-semibold uppercase tracking-wider hover:bg-[#758E75] transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Run AI Simulation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
