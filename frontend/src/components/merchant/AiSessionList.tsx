import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import type { AiSessionSummary } from '../../services/explainabilityService';
import { Sparkles, Eye, Clock } from 'lucide-react';

interface AiSessionListProps {
  sessions: AiSessionSummary[];
  selectedFilter: string;
  onFilterChange: (filter: any) => void;
  onSelectSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export const AiSessionList: React.FC<AiSessionListProps> = ({
  sessions,
  selectedFilter,
  onFilterChange,
  onSelectSession,
}) => {
  const filterPills = [
    { id: 'all', label: 'All Activity' },
    { id: 'searches', label: 'Searches' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'cart', label: 'Cart Actions' },
    { id: 'checkout', label: 'Checkout Safety' },
    { id: 'payments', label: 'Payments' },
    { id: 'failures', label: 'Failures & Recoveries' },
    { id: 'orders', label: 'Completed Orders' },
  ];

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-background-elevated rounded-2xl border border-[#E6E2DA] dark:border-[#3E443D] overflow-x-auto">
        {filterPills.map((pill) => (
          <button
            key={pill.id}
            onClick={() => onFilterChange(pill.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all ${
              selectedFilter === pill.id
                ? 'bg-background-primary text-text-primary shadow-xs font-semibold border border-[#E6E2DA] dark:border-[#3E443D]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-background-elevated border border-dashed border-[#E6E2DA] dark:border-[#3E443D] space-y-3">
          <Clock className="w-10 h-10 mx-auto text-text-secondary opacity-50" />
          <h3 className="text-base font-semibold text-text-primary font-display">
            No AI shopping activity yet
          </h3>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            AI shopping sessions, recommendation steps, and guardrail validations will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {sessions.map((session, index) => (
            <motion.div
              key={session.sessionId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              onClick={() => onSelectSession(session.sessionId)}
              className="p-4 sm:p-5 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] hover:border-[#8AA48A] hover:bg-background-primary/50 cursor-pointer transition-all space-y-3 group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-[#CFD8CF]/40 dark:bg-[#343833] text-[#4A5B4A] dark:text-[#8AA48A]">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-text-primary">
                        {session.sessionId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          session.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : session.status === 'FAILED'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            : session.status === 'IN_PROGRESS'
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                            : 'bg-stone-500/15 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {session.status.replace('_', ' ')}
                      </span>
                    </div>

                    {session.primaryIntent ? (
                      <p className="text-xs text-text-secondary mt-0.5">
                        Intent: <span className="italic text-text-primary">"{session.primaryIntent}"</span>
                      </p>
                    ) : (
                      <p className="text-xs text-text-secondary mt-0.5">
                        Interactive luxury apparel consultation
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  {session.hasOrder && session.orderAmount && (
                    <div className="text-right">
                      <span className="text-[10px] text-text-secondary uppercase tracking-wider block">
                        Order Settled
                      </span>
                      <span className="font-semibold text-text-primary font-display">
                        {formatCurrency(session.orderAmount)}
                      </span>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="text-[10px] text-text-secondary uppercase tracking-wider block">
                      Events
                    </span>
                    <span className="font-semibold text-text-primary">
                      {session.totalActions}
                    </span>
                  </div>

                  <div className="text-right text-text-secondary text-[11px] whitespace-nowrap">
                    {formatDate(session.startedAt)}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSession(session.sessionId);
                    }}
                    className="p-2 rounded-xl border border-transparent group-hover:border-[#8AA48A]/40 text-text-secondary group-hover:text-text-primary transition-all shrink-0"
                    title="Inspect AI Audit Trail"
                  >
                    <Eye className="w-4 h-4 text-[#8AA48A]" />
                  </button>
                </div>
              </div>

              {/* Action Badges Preview */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {session.actionTypes.map((action, ai) => (
                  <span
                    key={ai}
                    className="px-2 py-0.5 rounded-md bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] text-[10px] text-text-secondary"
                  >
                    {action.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
