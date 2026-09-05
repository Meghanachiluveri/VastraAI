import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ArrowRight, X, Check, Trash2 } from 'lucide-react';
import type { AISelectedItem } from '../../types/ai';
import { formatCurrency } from '../../lib/utils';

interface SelectionTrayProps {
  selectedItems: AISelectedItem[];
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
  onAddToBag: () => void;
  onBuySelected: () => void;
}

export const SelectionTray: React.FC<SelectionTrayProps> = ({
  selectedItems,
  onRemoveItem,
  onClear,
  onAddToBag,
  onBuySelected,
}) => {
  if (selectedItems.length === 0) return null;

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.product.price * (item.quantity || 1)), 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl mx-auto mb-3 bg-[#FCFCF9]/95 dark:bg-[#252A25]/95 border border-[#8AA48A]/40 dark:border-[#8AA48A]/30 rounded-2xl p-3.5 sm:p-4 shadow-soft backdrop-blur-md text-[#2A2A2A] dark:text-[#F6F7F2]"
      >
        {/* Tray Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8AA48A] animate-pulse" />
            <h4 className="text-[11px] font-sans font-bold tracking-[0.14em] uppercase text-[#5E6854] dark:text-[#8AA48A]">
              {selectedItems.length} {selectedItems.length === 1 ? 'ITEM' : 'ITEMS'} SELECTED
            </h4>
            <span className="text-xs font-serif font-semibold text-text-primary dark:text-[#F6F7F2]">
              • {formatCurrency(totalAmount)}
            </span>
          </div>

          <button
            onClick={onClear}
            className="text-[11px] text-text-secondary hover:text-red-600 dark:hover:text-red-400 font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Clear current selection"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>

        {/* Selected Items List */}
        <div className="py-2.5 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {selectedItems.map((item) => (
            <div
              key={item.productId}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F6F7F2] dark:bg-[#1F231F] border border-[#8AA48A]/30 text-xs shadow-xs"
            >
              <Check className="w-3.5 h-3.5 text-[#8AA48A] stroke-[2.5]" />
              <span className="font-medium text-[#2A2A2A] dark:text-[#F6F7F2] max-w-[180px] sm:max-w-[240px] truncate">
                {item.product.name}
              </span>
              <span className="text-text-secondary text-[11px]">
                ({formatCurrency(item.product.price)})
              </span>
              <button
                onClick={() => onRemoveItem(item.productId)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-stone-300 dark:hover:bg-stone-700 text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2] transition-colors cursor-pointer ml-1"
                title={`Remove ${item.product.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="pt-2.5 border-t border-[#E6E2DA] dark:border-[#3E443D] flex items-center justify-between gap-3">
          <button
            onClick={onAddToBag}
            className="flex-1 py-2 px-4 rounded-full border border-[#8AA48A] text-[#2A2A2A] dark:text-[#F6F7F2] hover:bg-[#8AA48A]/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#8AA48A]" />
            <span>
              {selectedItems.length === 2
                ? 'Add both to bag'
                : selectedItems.length > 2
                ? 'Add all to bag'
                : 'Add to bag'}
            </span>
          </button>

          <button
            onClick={onBuySelected}
            className="flex-1 py-2 px-4 rounded-full bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sage transition-all cursor-pointer"
          >
            <span>Buy selected</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
