import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import { Sparkles, ShoppingBag } from 'lucide-react';

interface HumanVsAiProps {
  overview: {
    totalRevenue: number;
    aiRevenue: number;
    humanRevenue: number;
    totalOrders: number;
    aiOrders: number;
    humanOrders: number;
    avgAiOrderValue: number;
    avgHumanOrderValue: number;
  };
}

export const HumanVsAiComparison: React.FC<HumanVsAiProps> = ({ overview }) => {
  const {
    totalRevenue,
    aiRevenue,
    humanRevenue,
    totalOrders,
    aiOrders,
    humanOrders,
    avgAiOrderValue,
    avgHumanOrderValue,
  } = overview;

  const aiRevShare = totalRevenue > 0 ? Math.round((aiRevenue / totalRevenue) * 100) : 0;
  const humanRevShare = totalRevenue > 0 ? 100 - aiRevShare : 0;

  const aiOrderShare = totalOrders > 0 ? Math.round((aiOrders / totalOrders) * 100) : 0;
  const humanOrderShare = totalOrders > 0 ? 100 - aiOrderShare : 0;

  const aovDiff = avgHumanOrderValue > 0
    ? Math.round(((avgAiOrderValue - avgHumanOrderValue) / avgHumanOrderValue) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="p-6 sm:p-7 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text-primary font-display">
            Commerce Channel Comparison
          </h2>
          <p className="text-xs text-text-secondary">
            Comparative performance between AI Shopping Concierge and Storefront Web Checkout.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8AA48A]" />
            <span className="text-text-primary font-medium">AI Concierge</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A89F91]" />
            <span className="text-text-secondary">Storefront</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Revenue Breakdown */}
        <div className="p-4 rounded-xl bg-background-primary/40 border border-[#E6E2DA]/80 dark:border-[#3E443D]/80 space-y-3">
          <div className="flex justify-between items-center text-xs font-medium">
            <span className="text-text-secondary">Revenue Contribution</span>
            <span className="text-text-primary">{formatCurrency(totalRevenue)} total</span>
          </div>

          <div className="h-3.5 w-full bg-[#E6E2DA] dark:bg-[#2C302B] rounded-full overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${aiRevShare}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-[#8AA48A]"
              title={`AI Revenue: ${formatCurrency(aiRevenue)} (${aiRevShare}%)`}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${humanRevShare}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-[#A89F91]"
              title={`Storefront Revenue: ${formatCurrency(humanRevenue)} (${humanRevShare}%)`}
            />
          </div>

          <div className="flex justify-between text-xs pt-1">
            <div className="flex items-center gap-1.5 text-[#4A5B4A] dark:text-[#8AA48A]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-semibold">{formatCurrency(aiRevenue)}</span>
              <span className="text-[11px] text-text-secondary">({aiRevShare}%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="font-medium text-text-primary">{formatCurrency(humanRevenue)}</span>
              <span className="text-[11px]">({humanRevShare}%)</span>
            </div>
          </div>
        </div>

        {/* Order Volume Breakdown */}
        <div className="p-4 rounded-xl bg-background-primary/40 border border-[#E6E2DA]/80 dark:border-[#3E443D]/80 space-y-3">
          <div className="flex justify-between items-center text-xs font-medium">
            <span className="text-text-secondary">Order Volume</span>
            <span className="text-text-primary">{totalOrders} order{totalOrders === 1 ? '' : 's'}</span>
          </div>

          <div className="h-3.5 w-full bg-[#E6E2DA] dark:bg-[#2C302B] rounded-full overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${aiOrderShare}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-[#8AA48A]"
              title={`AI Orders: ${aiOrders} (${aiOrderShare}%)`}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${humanOrderShare}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-[#A89F91]"
              title={`Storefront Orders: ${humanOrders} (${humanOrderShare}%)`}
            />
          </div>

          <div className="flex justify-between text-xs pt-1">
            <div className="flex items-center gap-1.5 text-[#4A5B4A] dark:text-[#8AA48A]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-semibold">{aiOrders} AI order{aiOrders === 1 ? '' : 's'}</span>
              <span className="text-[11px] text-text-secondary">({aiOrderShare}%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="font-medium text-text-primary">{humanOrders} Web order{humanOrders === 1 ? '' : 's'}</span>
              <span className="text-[11px]">({humanOrderShare}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Average Order Value Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl border border-[#8AA48A]/30 bg-[#CFD8CF]/20 dark:bg-[#343833]/40">
          <span className="text-[11px] font-semibold text-[#4A5B4A] dark:text-[#8AA48A] uppercase tracking-wider block mb-1">
            AI Average Order Value
          </span>
          <div className="text-xl font-semibold text-text-primary font-display">
            {formatCurrency(avgAiOrderValue)}
          </div>
          <span className="text-[11px] text-text-secondary block mt-1">
            Bespoke curated styling
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-background-primary/30">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
            Storefront Average Order Value
          </span>
          <div className="text-xl font-semibold text-text-primary font-display">
            {formatCurrency(avgHumanOrderValue)}
          </div>
          <span className="text-[11px] text-text-secondary block mt-1">
            Organic catalogue browsing
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-background-primary/30 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
            AI Basket Premium
          </span>
          <div className="flex items-center gap-2">
            <div className={`text-xl font-semibold font-display ${aovDiff >= 0 ? 'text-[#4A5B4A] dark:text-[#8AA48A]' : 'text-text-primary'}`}>
              {aovDiff >= 0 ? `+${aovDiff}%` : `${aovDiff}%`}
            </div>
            {aovDiff > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#8AA48A]/20 text-[#4A5B4A] dark:text-[#8AA48A] text-[10px] font-medium">
                Higher Ticket
              </span>
            )}
          </div>
          <span className="text-[11px] text-text-secondary block mt-1">
            {aovDiff >= 0 ? 'Driven by bounded upselling & tailored looks' : 'Comparable basket sizes'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
