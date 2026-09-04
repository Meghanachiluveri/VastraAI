import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, Tag, ShoppingBag, CreditCard, CheckCircle2 } from 'lucide-react';

interface AiFunnelProps {
  funnel: {
    sessions: number;
    recommendations: number;
    cartAdditions: number;
    checkoutAttempts: number;
    confirmedOrders: number;
    conversionRate: number;
  };
}

export const AiFunnelSection: React.FC<AiFunnelProps> = ({ funnel }) => {
  const {
    sessions,
    recommendations,
    cartAdditions,
    checkoutAttempts,
    confirmedOrders,
    conversionRate,
  } = funnel;

  const stages = [
    {
      id: 'sessions',
      title: 'AI Shopping Sessions',
      count: sessions,
      icon: <MessageSquare className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A]" />,
      desc: 'Patrons chatting with Stylist',
      rate: '100%',
    },
    {
      id: 'recommendations',
      title: 'Products Recommended',
      count: recommendations,
      icon: <Tag className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A]" />,
      desc: 'Curated artisanal suggestions',
      rate: sessions > 0 ? `${Math.min(100, Math.round((recommendations / sessions) * 100))}%` : '0%',
    },
    {
      id: 'cartAdditions',
      title: 'AI Cart Additions',
      count: cartAdditions,
      icon: <ShoppingBag className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A]" />,
      desc: 'Items added via concierge',
      rate: sessions > 0 ? `${Math.min(100, Math.round((cartAdditions / sessions) * 100))}%` : '0%',
    },
    {
      id: 'checkoutAttempts',
      title: 'Checkout Prepared',
      count: checkoutAttempts,
      icon: <CreditCard className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A]" />,
      desc: 'Patrons reaching payment gate',
      rate: sessions > 0 ? `${Math.min(100, Math.round((checkoutAttempts / sessions) * 100))}%` : '0%',
    },
    {
      id: 'confirmedOrders',
      title: 'Confirmed Orders',
      count: confirmedOrders,
      icon: <CheckCircle2 className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A]" />,
      desc: 'Completed luxury purchases',
      rate: `${conversionRate}%`,
    },
  ];

  const maxCount = Math.max(1, sessions, recommendations, cartAdditions, checkoutAttempts, confirmedOrders);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
      className="p-6 sm:p-7 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4A5B4A] dark:text-[#8AA48A]" />
            <h2 className="text-lg font-semibold text-text-primary font-display">
              AI Shopping Conversion Funnel
            </h2>
          </div>
          <p className="text-xs text-text-secondary">
            Tracking patron progression from conversational inquiry to finalized Razorpay payment.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-[#CFD8CF]/30 dark:bg-[#343833] border border-[#8AA48A]/30 flex items-center gap-2">
          <span className="text-[11px] text-text-secondary">Overall Conversion:</span>
          <span className="text-sm font-semibold text-[#4A5B4A] dark:text-[#8AA48A] font-display">
            {conversionRate}%
          </span>
        </div>
      </div>

      {sessions === 0 ? (
        <div className="p-8 text-center rounded-xl bg-background-primary/30 border border-dashed border-[#E6E2DA] dark:border-[#3E443D]">
          <Sparkles className="w-8 h-8 mx-auto text-[#8AA48A] mb-2 opacity-60" />
          <p className="text-sm font-medium text-text-primary">No AI shopping activity yet</p>
          <p className="text-xs text-text-secondary mt-1">
            AI conversion metrics will appear once patrons interact with the Vastra.AI Stylist.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {stages.map((stage, idx) => {
            const barWidth = Math.max(8, Math.round((stage.count / maxCount) * 100));
            return (
              <div key={stage.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D]">
                      {stage.icon}
                    </span>
                    <span className="font-medium text-text-primary">{stage.title}</span>
                    <span className="text-[11px] text-text-secondary hidden sm:inline">— {stage.desc}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-text-primary font-display">{stage.count}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary min-w-[42px] text-center">
                      {stage.rate}
                    </span>
                  </div>
                </div>

                <div className="h-2.5 w-full bg-[#E6E2DA]/60 dark:bg-[#2C302B] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      idx === stages.length - 1
                        ? 'bg-[#4A5B4A] dark:bg-[#8AA48A]'
                        : 'bg-[#8AA48A]/80 dark:bg-[#8AA48A]/60'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
