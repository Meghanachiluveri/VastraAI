import React from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatCurrency } from '../../lib/utils';
import type { SimulationResult } from '../../services/simulationService';
import {
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Tag,
  CreditCard,
  MessageSquare,
  Repeat,
} from 'lucide-react';

interface SimulationResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: SimulationResult | null;
  onRunAnother: () => void;
}

export const SimulationResultsModal: React.FC<SimulationResultsModalProps> = ({
  isOpen,
  onClose,
  result,
  onRunAnother,
}) => {
  if (!result) return null;

  const funnelStages = [
    {
      label: 'AI Shopping Sessions',
      count: result.sessions,
      rate: '100%',
      icon: MessageSquare,
    },
    {
      label: 'Product Recommendations',
      count: result.recommendations,
      rate: result.sessions > 0 ? `${Math.min(100, Math.round((result.recommendations / result.sessions) * 100))}%` : '0%',
      icon: Tag,
    },
    {
      label: 'Cart Additions',
      count: result.cartAdditions,
      rate: result.sessions > 0 ? `${Math.min(100, Math.round((result.cartAdditions / result.sessions) * 100))}%` : '0%',
      icon: ShoppingBag,
    },
    {
      label: 'Checkout Attempts',
      count: result.checkoutAttempts,
      rate: result.sessions > 0 ? `${Math.min(100, Math.round((result.checkoutAttempts / result.sessions) * 100))}%` : '0%',
      icon: CreditCard,
    },
    {
      label: 'Successful Orders',
      count: result.successfulOrders,
      rate: `${result.conversionRate}%`,
      icon: CheckCircle2,
    },
  ];

  const maxFunnelCount = Math.max(1, result.sessions, result.recommendations, result.cartAdditions, result.checkoutAttempts, result.successfulOrders);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title="AI Shopping Simulation Results"
    >
      <div className="space-y-6 pt-2">
        <p className="text-xs text-text-secondary -mt-2">
          Synthesized performance across {result.numberOfShoppers} simulated shoppers.
        </p>
        {/* Prominent Simulation Disclaimer Banner */}
        <div className="p-3.5 rounded-xl bg-[#CFD8CF]/30 dark:bg-[#343833] border border-[#8AA48A]/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-text-primary font-medium">
            <span className="px-2 py-0.5 rounded bg-[#8AA48A] text-[#2A2A2A] text-[10px] font-bold tracking-wider uppercase">
              SIMULATION
            </span>
            <span>Simulated Campaign ID: <strong className="font-mono text-xs">{result.simulationId}</strong></span>
          </div>
          <span className="text-[11px] text-text-secondary">
            Isolated Sandbox Mode
          </span>
        </div>

        {/* 4 High-Level Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-background-elevated border border-[#8AA48A]/30 space-y-1">
            <span className="text-[10px] font-semibold text-[#4A5B4A] dark:text-[#8AA48A] uppercase tracking-wider block">
              Simulated Revenue
            </span>
            <div className="text-xl sm:text-2xl font-semibold text-text-primary font-display">
              {formatCurrency(result.revenue)}
            </div>
            <span className="text-[10px] text-text-secondary block">
              From {result.successfulOrders} successful orders
            </span>
          </div>

          <div className="p-4 rounded-xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-1">
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
              AI Conversion Rate
            </span>
            <div className="text-xl sm:text-2xl font-semibold text-text-primary font-display">
              {result.conversionRate}%
            </div>
            <span className="text-[10px] text-text-secondary block">
              Sessions to completed orders
            </span>
          </div>

          <div className="p-4 rounded-xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-1">
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
              Upsell Acceptance
            </span>
            <div className="text-xl sm:text-2xl font-semibold text-text-primary font-display">
              {result.upsellAcceptanceRate}%
            </div>
            <span className="text-[10px] text-text-secondary block">
              {result.upsellAccepted} of {result.upsellSuggestions} accepted
            </span>
          </div>

          <div className="p-4 rounded-xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-1">
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
              Average Order Value
            </span>
            <div className="text-xl sm:text-2xl font-semibold text-text-primary font-display">
              {formatCurrency(result.averageOrderValue)}
            </div>
            <span className="text-[10px] text-text-secondary block">
              Per simulated checkout
            </span>
          </div>
        </div>

        {/* 5-Stage AI Shopping Conversion Funnel */}
        <div className="p-5 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#8AA48A]" />
              <h3 className="font-semibold text-text-primary font-display">
                Simulated AI Shopper Funnel
              </h3>
            </div>
            {result.failedPayments > 0 && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {result.failedPayments} simulated payment declines
              </span>
            )}
          </div>

          <div className="space-y-3">
            {funnelStages.map((stage, idx) => {
              const barWidth = Math.max(8, Math.round((stage.count / maxFunnelCount) * 100));
              return (
                <div key={stage.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {React.createElement(stage.icon, {
                        className: 'w-3.5 h-3.5 text-[#8AA48A]',
                      })}
                      <span className="text-text-primary font-medium">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-text-primary font-display">{stage.count}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary min-w-[40px] text-center">
                        {stage.rate}
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-[#E6E2DA]/60 dark:bg-[#2C302B] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.08, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        idx === funnelStages.length - 1
                          ? 'bg-[#4A5B4A] dark:bg-[#8AA48A]'
                          : 'bg-[#8AA48A]/80 dark:bg-[#8AA48A]/60'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Simulated Products */}
        {result.topProducts && result.topProducts.length > 0 && (
          <div className="p-5 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-3">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Top Interacted Artisanal Pieces
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {result.topProducts.slice(0, 6).map((prod) => (
                <div
                  key={prod.productId}
                  className="p-3 rounded-xl bg-background-primary/40 border border-[#E6E2DA] dark:border-[#3E443D] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-9 h-11 object-cover rounded-lg shrink-0 border border-[#E6E2DA] dark:border-[#3E443D]"
                      />
                    ) : (
                      <div className="w-9 h-11 rounded-lg bg-background-elevated flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-text-secondary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-text-primary truncate">{prod.name}</div>
                      <div className="text-[11px] text-text-secondary">{formatCurrency(prod.price)}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 rounded bg-[#8AA48A]/20 text-[#4A5B4A] dark:text-[#8AA48A] text-[10px] font-semibold">
                      {prod.purchasedCount} sold
                    </span>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      {prod.recommendedCount} recs • {prod.addedToCartCount} bags
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E6E2DA] dark:border-[#3E443D]">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRunAnother}
            leftIcon={<Repeat className="w-3.5 h-3.5" />}
          >
            Run Another Simulation
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
          >
            Close Results
          </Button>
        </div>
      </div>
    </Modal>
  );
};
