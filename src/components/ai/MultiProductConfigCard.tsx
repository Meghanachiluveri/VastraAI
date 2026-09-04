import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { AISelectedItem } from '../../types/ai';
import { formatCurrency } from '../../lib/utils';

interface MultiProductConfigCardProps {
  items: AISelectedItem[];
  onUpdateItemOption: (productId: string, updates: { size?: string; color?: string; quantity?: number }) => void;
  onProceedToCheckout: () => void;
  onCancel: () => void;
}

export const MultiProductConfigCard: React.FC<MultiProductConfigCardProps> = ({
  items,
  onUpdateItemOption,
  onProceedToCheckout,
  onCancel,
}) => {
  if (items.length === 0) return null;

  const totalAmount = items.reduce((sum, item) => sum + (item.product.price * (item.quantity || 1)), 0);
  const exceedsAiLimit = totalAmount > 10000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 sm:p-6 rounded-3xl bg-[#FCFCF9] dark:bg-[#252A25] border border-[#8AA48A]/40 dark:border-[#8AA48A]/30 space-y-5 shadow-soft text-[#2A2A2A] dark:text-[#F6F7F2]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E6E2DA] dark:border-[#3E443D] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#8AA48A]" />
          <h4 className="text-xs uppercase tracking-widest font-bold text-[#2A2A2A] dark:text-[#F6F7F2]">
            {items.length === 1 ? 'Configure Your Piece' : `Configure Your ${items.length} Pieces`}
          </h4>
        </div>
        <button
          onClick={onCancel}
          className="text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2] transition-colors p-1"
          title="Dismiss configuration"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-text-secondary dark:text-[#C8CDC5] leading-relaxed">
        {items.length === 1
          ? 'Please select your preferred size and color for this handcrafted garment before proceeding to review.'
          : 'Please select your preferred sizes and colors for each handcrafted garment before proceeding to review.'}
      </p>

      {/* Per-Product Option Selectors */}
      <div className="space-y-4">
        {items.map((item, index) => {
          const prod = item.product;
          const activeSize = item.size || prod.sizes[0] || 'M';
          const activeColor = item.color || prod.colors[0] || 'Default';
          const qty = item.quantity || 1;

          return (
            <div
              key={item.productId}
              className="p-4 rounded-2xl bg-[#F6F7F2] dark:bg-[#1F231F] border border-[#E6E2DA] dark:border-[#3E443D] space-y-3"
            >
              {/* Product Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#8AA48A]/20 text-[#5E6854] dark:text-[#8AA48A] text-[10px] font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h5 className="font-medium text-xs sm:text-sm text-[#2A2A2A] dark:text-[#F6F7F2] line-clamp-1">
                      {prod.name}
                    </h5>
                    <span className="text-[11px] font-semibold text-text-secondary">
                      {formatCurrency(prod.price)} each
                    </span>
                  </div>
                </div>

                <span className="font-serif font-bold text-xs sm:text-sm text-[#2A2A2A] dark:text-[#F6F7F2]">
                  {formatCurrency(prod.price * qty)}
                </span>
              </div>

              {/* Size Selection */}
              {prod.sizes && prod.sizes.length > 0 && !prod.sizes.includes('Free Size') && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary block">
                    Select Size:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {prod.sizes.map((sz) => {
                      const isChosen = activeSize === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => onUpdateItemOption(item.productId, { size: sz })}
                          className={`px-3 py-1 text-xs rounded-full font-medium transition-all cursor-pointer ${isChosen
                              ? 'bg-[#8AA48A] text-[#2A2A2A] font-bold shadow-xs'
                              : 'border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A]'
                            }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color Selection (if product offers options) */}
              {prod.colors && prod.colors.length > 1 && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary block">
                    Select Color:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {prod.colors.map((col) => {
                      const isChosen = activeColor === col;
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => onUpdateItemOption(item.productId, { color: col })}
                          className={`px-3 py-1 text-xs rounded-full font-medium transition-all cursor-pointer ${isChosen
                              ? 'bg-[#8AA48A] text-[#2A2A2A] font-bold shadow-xs'
                              : 'border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A]'
                            }`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Controls */}
              <div className="flex items-center justify-between pt-1 border-t border-[#E6E2DA]/60 dark:border-[#3E443D]/60 text-xs">
                <span className="text-text-secondary text-[11px]">Quantity:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateItemOption(item.productId, { quantity: Math.max(1, qty - 1) })}
                    className="w-6 h-6 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    -
                  </button>
                  <span className="font-semibold px-1">{qty}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateItemOption(item.productId, { quantity: qty + 1 })}
                    className="w-6 h-6 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Spending Limit Guardrail Alert */}
      {exceedsAiLimit && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            The combined total of <strong>{formatCurrency(totalAmount)}</strong> exceeds Vastra.AI&apos;s ₹10,000 spending limit for AI purchases. Please adjust quantity or select alternative pieces. (Manual purchases via our storefront have no limit).
          </p>
        </div>
      )}

      {/* Total & Proceed Button */}
      <div className="border-t border-[#E6E2DA] dark:border-[#3E443D] pt-4 flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] text-text-secondary block">Combined Total:</span>
          <span className="font-serif font-bold text-base sm:text-lg text-[#2A2A2A] dark:text-[#F6F7F2]">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="py-2.5 px-4 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] text-xs font-medium text-text-secondary hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onProceedToCheckout}
            disabled={exceedsAiLimit}
            className="py-2.5 px-5 rounded-full bg-[#8AA48A] hover:bg-[#758E75] disabled:opacity-50 text-[#2A2A2A] text-xs font-semibold shadow-sage flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Proceed to Review</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};