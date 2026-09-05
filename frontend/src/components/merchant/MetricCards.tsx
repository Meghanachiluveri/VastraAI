import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import { Sparkles, ShoppingBag, ArrowUpRight, TrendingUp } from 'lucide-react';

interface MetricCardsProps {
  overview: {
    totalRevenue: number;
    aiRevenue: number;
    humanRevenue: number;
    totalOrders: number;
    aiOrders: number;
    humanOrders: number;
    aiSessions: number;
    aiConversionRate: number;
  };
}

export const MetricCards: React.FC<MetricCardsProps> = ({ overview }) => {
  const aiSharePercent = overview.totalRevenue > 0
    ? Math.round((overview.aiRevenue / overview.totalRevenue) * 100)
    : 0;

  const humanSharePercent = overview.totalRevenue > 0
    ? Math.round((overview.humanRevenue / overview.totalRevenue) * 100)
    : 0;

  const cards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(overview.totalRevenue),
      subtitle: `${overview.totalOrders} paid order${overview.totalOrders === 1 ? '' : 's'} across channels`,
      badge: 'All Orders',
      icon: <TrendingUp className="w-5 h-5 text-text-primary" />,
      highlight: false,
    },
    {
      title: 'AI Shopping Revenue',
      value: formatCurrency(overview.aiRevenue),
      subtitle: `${aiSharePercent}% of total store revenue generated via AI`,
      badge: `${overview.aiOrders} AI order${overview.aiOrders === 1 ? '' : 's'}`,
      icon: <Sparkles className="w-5 h-5 text-[#4A5B4A] dark:text-[#8AA48A]" />,
      highlight: true,
      highlightText: 'Vastra.AI Impact',
    },
    {
      title: 'Human Storefront Revenue',
      value: formatCurrency(overview.humanRevenue),
      subtitle: `${humanSharePercent}% of total revenue from organic web shoppers`,
      badge: `${overview.humanOrders} web order${overview.humanOrders === 1 ? '' : 's'}`,
      icon: <ShoppingBag className="w-5 h-5 text-text-secondary" />,
      highlight: false,
    },
    {
      title: 'AI Conversion Rate',
      value: `${overview.aiConversionRate}%`,
      subtitle: `${overview.aiOrders} orders out of ${overview.aiSessions} AI shopper sessions`,
      badge: `${overview.aiSessions} sessions`,
      icon: <ArrowUpRight className="w-5 h-5 text-[#4A5B4A] dark:text-[#8AA48A]" />,
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.08 }}
          className={`p-5 sm:p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
            card.highlight
              ? 'bg-[#CFD8CF]/25 dark:bg-[#343833]/60 border-[#8AA48A]/40 shadow-sm'
              : 'bg-background-elevated border-[#E6E2DA] dark:border-[#3E443D]'
          }`}
        >
          {card.highlight && (
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#8AA48A]/20 text-[#4A5B4A] dark:text-[#8AA48A] text-[10px] font-semibold tracking-wider uppercase rounded-bl-xl border-b border-l border-[#8AA48A]/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {card.highlightText}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary tracking-wide uppercase">
                {card.title}
              </span>
              <div className="p-2 rounded-xl bg-background-primary/60 border border-[#E6E2DA] dark:border-[#3E443D]">
                {card.icon}
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-semibold text-text-primary font-display tracking-tight mb-1">
              {card.value}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-[#E6E2DA]/60 dark:border-[#3E443D]/60 flex items-center justify-between text-xs text-text-secondary">
            <span className="truncate pr-2">{card.subtitle}</span>
            <span className="px-2 py-0.5 rounded-full bg-background-primary text-[10px] font-medium border border-[#E6E2DA] dark:border-[#3E443D] shrink-0">
              {card.badge}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
