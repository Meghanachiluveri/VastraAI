import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Tag,
  PlusCircle,
  Clock,
} from 'lucide-react';

export interface MerchantActivity {
  id: string;
  orderId?: string | null;
  sessionId?: string | null;
  channel: 'human' | 'agent';
  action: string;
  description: string;
  details?: any;
  outcome?: string;
  createdAt: string;
}

interface AiActivityFeedProps {
  activities: MerchantActivity[];
  onSelectSession?: (sessionId: string) => void;
  isLoading?: boolean;
}

export const AiActivityFeed: React.FC<AiActivityFeedProps> = ({
  activities,
  onSelectSession,
}) => {
  const getActionIcon = (action: string, channel: 'human' | 'agent') => {
    if (action.includes('upsell')) {
      return <PlusCircle className="w-3.5 h-3.5 text-[#8AA48A]" />;
    }
    if (action.includes('recommend') || action === 'propose') {
      return <Tag className="w-3.5 h-3.5 text-[#8AA48A]" />;
    }
    if (action.includes('payment_verified') || action === 'order_confirmed') {
      return <CheckCircle2 className="w-3.5 h-3.5 text-[#8AA48A]" />;
    }
    if (action.includes('payment_failed') || action.includes('failure')) {
      return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
    }
    if (action.includes('bag') || action.includes('cart')) {
      return <ShoppingBag className="w-3.5 h-3.5 text-text-secondary" />;
    }
    if (channel === 'agent') {
      return <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />;
    }
    return <Clock className="w-3.5 h-3.5 text-text-secondary" />;
  };

  const formatTime = (timeStr: string) => {
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="p-6 sm:p-7 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E6E2DA]/60 dark:border-[#3E443D]/60">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8AA48A]" />
            <h2 className="text-lg font-semibold text-text-primary font-display">
              Live AI & Commerce Activity
            </h2>
          </div>
          <p className="text-xs text-text-secondary">
            Audit-logged timeline of shopper interactions, recommendations, and settlements.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#4A5B4A] dark:text-[#8AA48A] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#8AA48A] animate-pulse" />
          <span>Live SQLite Stream</span>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-background-primary/30 border border-dashed border-[#E6E2DA] dark:border-[#3E443D]">
          <Clock className="w-7 h-7 mx-auto text-text-secondary mb-2 opacity-50" />
          <p className="text-sm font-medium text-text-primary">No recent activity</p>
          <p className="text-xs text-text-secondary mt-1">
            Shopper interactions and AI actions will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          {activities.map((act) => (
            <div
              key={act.id}
              onClick={() => {
                if (act.sessionId && onSelectSession) {
                  onSelectSession(act.sessionId);
                }
              }}
              className={`p-3.5 rounded-xl bg-background-primary/40 border border-[#E6E2DA]/80 dark:border-[#3E443D]/80 flex items-start gap-3 transition-colors ${
                act.sessionId && onSelectSession ? 'hover:bg-background-primary/80 cursor-pointer hover:border-[#8AA48A]/50' : ''
              }`}
            >
              <div className="p-2 rounded-lg bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] shrink-0 mt-0.5">
                {getActionIcon(act.action, act.channel)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {act.channel === 'agent' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#CFD8CF]/40 dark:bg-[#343833] text-[#4A5B4A] dark:text-[#8AA48A]">
                        AI Concierge
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background-elevated text-text-secondary">
                        Storefront
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-text-primary truncate">
                      {act.action.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <span className="text-[10px] text-text-secondary shrink-0 font-mono">
                    {formatTime(act.createdAt)}
                  </span>
                </div>

                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  {act.description}
                </p>

                {act.sessionId && (
                  <div className="flex items-center justify-between text-[10px] text-text-secondary/70 font-mono mt-1">
                    <span>session: {act.sessionId}</span>
                    {onSelectSession && (
                      <span className="text-[#4A5B4A] dark:text-[#8AA48A] hover:underline font-sans">
                        Inspect audit trail →
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
