import React from 'react';
import { motion } from 'framer-motion';
import { Drawer } from '../common/Drawer';
import { formatCurrency } from '../../lib/utils';
import type { AiSessionDetail } from '../../services/explainabilityService';
import {
  Search,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  UserCheck,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Clock,
  ArrowRight,
  Package,
} from 'lucide-react';

interface SessionTimelineDrawerProps {
  sessionDetail: AiSessionDetail | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

export const SessionTimelineDrawer: React.FC<SessionTimelineDrawerProps> = ({
  sessionDetail,
  isOpen,
  onClose,
  isLoading,
}) => {
  if (!sessionDetail && !isLoading) return null;

  const summary = sessionDetail?.summary;
  const timeline = sessionDetail?.timeline || [];

  const getEventIcon = (eventType: string, status: string) => {
    switch (eventType) {
      case 'search':
        return <Search className="w-3.5 h-3.5 text-[#8AA48A]" />;
      case 'recommendation':
      case 'propose':
        return <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />;
      case 'add_to_bag':
      case 'remove_from_bag':
        return <ShoppingBag className="w-3.5 h-3.5 text-[#8AA48A]" />;
      case 'upsell_suggested':
      case 'upsell_accepted':
      case 'upsell_declined':
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case 'guardrail_check':
      case 'gating_check':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />;
      case 'payment_attempt':
      case 'payment_verified':
      case 'payment_failed':
      case 'payment_cancelled':
        return <CreditCard className="w-3.5 h-3.5 text-[#8AA48A]" />;
      case 'order_created':
        return <Package className="w-3.5 h-3.5 text-emerald-500" />;
      case 'stock_failure':
      case 'tool_failure':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
      case 'price_changed':
        return <Tag className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return status === 'failed' ? (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-[#8AA48A]" />
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">
            Failed
          </span>
        );
      case 'declined':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
            Declined
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
            Pending
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-[#CFD8CF]/40 dark:bg-[#343833] text-text-secondary text-[10px] font-medium">
            Info
          </span>
        );
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      side="right"
      width="lg"
      title="AI Shopping Session Audit & Explainability"
    >
      <div className="space-y-6">
        <p className="text-xs text-text-secondary -mt-2">
          Chronological step-by-step activity timeline, safety guardrail checks, and human approvals.
        </p>
        {/* Session High-Level Summary Card */}
        {summary && (
          <div className="p-4 sm:p-5 rounded-2xl bg-background-elevated border border-[#8AA48A]/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#8AA48A] text-[#2A2A2A] text-[10px] font-bold uppercase tracking-wider">
                  AI SESSION
                </span>
                <span className="font-mono text-xs font-semibold text-text-primary">
                  {summary.sessionId}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  summary.status === 'COMPLETED'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : summary.status === 'FAILED'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    : summary.status === 'IN_PROGRESS'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                    : 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border border-stone-500/30'
                }`}
              >
                {summary.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div>
                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">
                  Actions Executed
                </span>
                <span className="font-semibold text-text-primary">
                  {summary.totalActions} events
                </span>
              </div>

              <div>
                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">
                  Order Status
                </span>
                <span className="font-semibold text-text-primary">
                  {summary.orderId ? (
                    <span className="text-[#4A5B4A] dark:text-[#8AA48A]">
                      #{summary.orderId} ({formatCurrency(summary.orderAmount || 0)})
                    </span>
                  ) : (
                    'No Order'
                  )}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">
                  Started At
                </span>
                <span className="text-text-secondary text-[11px]">
                  {formatTime(summary.startedAt)}
                </span>
              </div>
            </div>

            {summary.primaryIntent && (
              <div className="p-2.5 rounded-xl bg-background-primary/50 border border-[#E6E2DA] dark:border-[#3E443D] text-xs text-text-secondary">
                <strong className="text-text-primary font-medium">Customer Intent: </strong>
                <span>"{summary.primaryIntent}"</span>
              </div>
            )}
          </div>
        )}

        {/* Chronological Vertical Timeline */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#8AA48A]" />
            <span>Activity & Decision Timeline</span>
          </h3>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E6E2DA] dark:before:bg-[#3E443D]">
            {timeline.map((evt, index) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="relative space-y-2"
              >
                {/* Timeline Dot */}
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-background-primary border-2 border-[#8AA48A] flex items-center justify-center shadow-xs">
                  {getEventIcon(evt.eventType, evt.status)}
                </div>

                {/* Event Card */}
                <div className="p-4 rounded-xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-text-primary font-display flex items-center gap-1.5">
                        <span>{evt.title}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {evt.description}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {getStatusBadge(evt.status)}
                      <span className="text-[10px] font-mono text-text-secondary">
                        {formatTime(evt.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Explainability Callout (Why the AI acted) */}
                  {evt.explanation && (
                    <div className="p-2.5 rounded-lg bg-[#CFD8CF]/20 dark:bg-[#343833]/60 border border-[#8AA48A]/30 text-[11px] text-text-secondary">
                      <strong className="text-text-primary block font-medium mb-0.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#8AA48A]" />
                        Explainability Summary
                      </strong>
                      <span>{evt.explanation}</span>
                    </div>
                  )}

                  {/* Guardrail Safety Checks Box */}
                  {evt.guardrails && evt.guardrails.length > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Commerce Safety Guardrails Verified</span>
                      </div>
                      <div className="space-y-1 pt-1">
                        {evt.guardrails.map((g, gi) => (
                          <div key={gi} className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary flex items-center gap-1.5">
                              {g.passed ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                              )}
                              <span>{g.label}</span>
                            </span>
                            <span className="text-[10px] font-medium text-text-primary">
                              {g.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Human-in-the-Loop Confirmation Highlight */}
                  {evt.eventType === 'guardrail_check' && evt.title.includes('Guardrail') && (
                    <div className="p-2 rounded-lg bg-background-primary border border-[#8AA48A]/30 flex items-center gap-2 text-xs text-text-secondary">
                      <UserCheck className="w-4 h-4 text-[#8AA48A] shrink-0" />
                      <div>
                        <strong className="text-text-primary font-medium">Human-in-the-Loop Approval: </strong>
                        Customer explicitly confirmed this checkout.
                      </div>
                    </div>
                  )}

                  {/* Price Change Adjustment Box */}
                  {evt.priceChange && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
                      <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        <span>Price Adjustment Detected</span>
                      </div>
                      <div className="flex items-center gap-3 text-text-primary pt-0.5">
                        <span className="line-through text-text-secondary">
                          {formatCurrency(evt.priceChange.previousPrice)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-amber-500" />
                        <span className="font-semibold font-display text-text-primary">
                          {formatCurrency(evt.priceChange.currentPrice)}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary">
                        Backend required explicit shopper confirmation before processing checkout.
                      </p>
                    </div>
                  )}

                  {/* Failure & Recovery Box */}
                  {evt.failureDetails && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1 text-xs">
                      <div className="font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Failure Intercepted</span>
                      </div>
                      <p className="text-text-secondary">
                        <strong className="text-text-primary font-medium">Reason: </strong>
                        {evt.failureDetails.reason}
                      </p>
                      {evt.failureDetails.recoveryAction && (
                        <p className="text-text-secondary">
                          <strong className="text-text-primary font-medium">Recovery: </strong>
                          {evt.failureDetails.recoveryAction}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Payment Verification Box */}
                  {evt.paymentInfo && (
                    <div className="p-2.5 rounded-lg bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-[#8AA48A]" />
                        <span className="text-text-secondary">Razorpay Test Mode</span>
                      </div>
                      <span className="font-semibold text-text-primary font-display">
                        {formatCurrency(evt.paymentInfo.amount)}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
