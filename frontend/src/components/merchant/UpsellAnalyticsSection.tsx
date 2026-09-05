import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import { Sparkles, CheckCircle2, XCircle, ArrowUpRight, PlusCircle } from 'lucide-react';

interface UpsellAnalyticsProps {
  upsell: {
    upsellsSuggested: number;
    upsellsAccepted: number;
    upsellsDeclined: number;
    upsellAcceptanceRate: number;
    upsellRevenue: number;
  };
}

export const UpsellAnalyticsSection: React.FC<UpsellAnalyticsProps> = ({ upsell }) => {
  const {
    upsellsSuggested,
    upsellsAccepted,
    upsellsDeclined,
    upsellAcceptanceRate,
    upsellRevenue,
  } = upsell;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
      className="p-6 sm:p-7 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A]" />
            <h2 className="text-lg font-semibold text-text-primary font-display">
              AI Bounded Upsell Performance
            </h2>
          </div>
          <p className="text-xs text-text-secondary">
            Strictly bounded 1-item styling accompaniments suggested during conversational shopping.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-[#CFD8CF]/30 dark:bg-[#343833] text-[#4A5B4A] dark:text-[#8AA48A] text-xs font-semibold border border-[#8AA48A]/30">
            {upsellAcceptanceRate}% Acceptance Rate
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-background-primary/40 border border-[#E6E2DA] dark:border-[#3E443D]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Suggested
            </span>
            <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
          </div>
          <div className="text-2xl font-semibold text-text-primary font-display">
            {upsellsSuggested}
          </div>
          <span className="text-[10px] text-text-secondary mt-1 block">
            Bounded 1-item suggestions
          </span>
        </div>

        <div className="p-4 rounded-xl bg-background-primary/40 border border-[#8AA48A]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#4A5B4A] dark:text-[#8AA48A] uppercase tracking-wider">
              Accepted
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#8AA48A]" />
          </div>
          <div className="text-2xl font-semibold text-[#4A5B4A] dark:text-[#8AA48A] font-display">
            {upsellsAccepted}
          </div>
          <span className="text-[10px] text-text-secondary mt-1 block">
            Added to bag by patron
          </span>
        </div>

        <div className="p-4 rounded-xl bg-background-primary/40 border border-[#E6E2DA] dark:border-[#3E443D]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Declined
            </span>
            <XCircle className="w-3.5 h-3.5 text-text-secondary" />
          </div>
          <div className="text-2xl font-semibold text-text-primary font-display">
            {upsellsDeclined}
          </div>
          <span className="text-[10px] text-text-secondary mt-1 block">
            Gracefully unrepeated
          </span>
        </div>

        <div className="p-4 rounded-xl bg-background-primary/40 border border-[#E6E2DA] dark:border-[#3E443D]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Incremental GMV
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#8AA48A]" />
          </div>
          <div className="text-2xl font-semibold text-text-primary font-display">
            {formatCurrency(upsellRevenue)}
          </div>
          <span className="text-[10px] text-text-secondary mt-1 block">
            Direct upsell revenue
          </span>
        </div>
      </div>
    </motion.div>
  );
};
