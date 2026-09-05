import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product } from '../../types/types';
import { formatCurrency } from '../../lib/utils';
import { Badge } from '../common/Badge';
import { useCartStore } from '../../stores/useCartStore';
import { useUIStore } from '../../stores/useUIStore';
import { ShoppingBag, Eye, Heart, Star, Check } from 'lucide-react';

export interface ProductCardProps {
  product: Product;
  matchReason?: string;
  selectedSize?: string;
  onSelectSize?: (size: string) => void;
  onAddToCart?: (product: Product, size: string, color: string) => void;
  showDirectButtons?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  matchReason,
  selectedSize,
  onSelectSize,
  onAddToCart,
  showDirectButtons = false,
  isSelectable = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [internalSize, setInternalSize] = useState(product.sizes[0] || 'M');

  const addItem = useCartStore((state) => state.addItem);
  const openQuickView = useUIStore((state) => state.openQuickView);

  const activeColor = product.colors[selectedColorIndex] || product.colors[0] || 'Default';
  const activeSize = selectedSize || internalSize || product.sizes[0] || 'M';

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product, activeSize, activeColor);
    } else if (isSelectable) {
      addItem(product, activeColor, activeSize, 1, { openDrawer: false, channel: 'agent' });
    } else {
      addItem(product, activeColor, activeSize, 1);
    }
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openQuickView(product as any);
  };

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  return (
    <div
      className={`group relative flex flex-col justify-between bg-[#FCFCF9] dark:bg-[#343833] p-3.5 rounded-2xl border transition-all duration-300 shadow-subtle hover:shadow-soft ${
        isSelected
          ? 'border-[#8AA48A] ring-2 ring-[#8AA48A] bg-[#8AA48A]/5 dark:bg-[#8AA48A]/10 shadow-sage'
          : 'border-[#E6E2DA] dark:border-[#3E443D] hover:border-[#8AA48A]/50'
      }`}
    >
      {/* Top Part: Image + Basic Info */}
      <div className="space-y-3">
        {/* Product Image Frame */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-200/50 dark:bg-stone-800/50 rounded-xl border border-[#E6E2DA]/60 dark:border-[#3E443D]/60 transition-colors">
          {isSelectable ? (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect();
              }}
              className="block w-full h-full cursor-pointer select-none"
            >
              <motion.img
                src={product.imageUrl}
                alt={product.name}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85';
                }}
                className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-103"
              />
            </div>
          ) : (
            <Link to={`/product/${product.id}`} className="block w-full h-full">
              <motion.img
                src={product.imageUrl}
                alt={product.name}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85';
                }}
                className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-103"
              />
            </Link>
          )}

          {/* Top Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 pointer-events-none">
            <Badge variant="soft-sage">
              {product.category}
            </Badge>
          </div>

          {/* Rating Pill or Selected Badge (Top Right) */}
          <div className="absolute top-2.5 right-2.5 z-10">
            {isSelected ? (
              <span className="inline-flex items-center gap-1 bg-[#8AA48A] text-[#2A2A2A] px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-xs">
                <Check className="w-3 h-3 stroke-[2.5]" />
                Selected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-[#FCFCF9]/95 dark:bg-[#343833]/95 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-[#2A2A2A] dark:text-[#F6F7F2] shadow-xs border border-[#E6E2DA]/70 dark:border-[#3E443D]">
                <Star className="w-2.5 h-2.5 fill-[#C9A46A] text-[#C9A46A]" />
                {product.rating} <span className="text-text-secondary font-normal">({product.reviewCount})</span>
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            onClick={toggleWishlist}
            aria-label="Add to wishlist"
            className="absolute bottom-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-[#FCFCF9]/95 dark:bg-[#343833]/95 backdrop-blur-xs flex items-center justify-center text-text-secondary hover:text-[#8AA48A] transition-all shadow-xs opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isWishlisted ? 'fill-[#8AA48A] text-[#8AA48A]' : ''
              }`}
            />
          </button>

          {/* Quick Action Overlay (Bottom) */}
          <div className="absolute inset-x-2.5 bottom-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-10 pointer-events-auto">
            <button
              onClick={handleQuickAdd}
              className="flex-1 bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] py-2 px-3 text-xs uppercase tracking-editorial font-semibold rounded-full flex items-center justify-center gap-1.5 shadow-sage transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Quick Bag
            </button>
            <button
              onClick={handleQuickViewClick}
              aria-label="Quick preview"
              className="w-9 h-9 bg-[#FCFCF9]/95 dark:bg-[#3E443D]/95 text-[#2A2A2A] dark:text-[#F6F7F2] rounded-full backdrop-blur-xs flex items-center justify-center hover:bg-[#CFD8CF] transition-colors shadow-subtle cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Product Information */}
        <div className="flex flex-col space-y-1.5">
          {/* Color buttons */}
          {product.colors.length > 1 && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {product.colors.slice(0, 3).map((c, idx) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColorIndex(idx)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                    selectedColorIndex === idx
                      ? 'border-[#8AA48A] bg-[#CFD8CF] text-[#2A2A2A] font-semibold'
                      : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-baseline justify-between gap-2">
            {isSelectable ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onToggleSelect) onToggleSelect();
                }}
                className="text-sm font-medium text-[#2A2A2A] dark:text-[#F6F7F2] hover:text-[#8AA48A] transition-colors text-left line-clamp-1 cursor-pointer select-none"
              >
                {product.name}
              </button>
            ) : (
              <Link
                to={`/product/${product.id}`}
                className="text-sm font-medium text-[#2A2A2A] dark:text-[#F6F7F2] hover:text-[#8AA48A] transition-colors line-clamp-1"
              >
                {product.name}
              </Link>
            )}
          </div>

          <p className="text-xs text-text-secondary dark:text-[#C8CDC5] line-clamp-1 font-light">
            {product.description}
          </p>

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-semibold text-[#2A2A2A] dark:text-[#F6F7F2] tracking-tight">
              {formatCurrency(product.price)}
            </span>
            <span className="text-[11px] text-accent-sage font-medium uppercase tracking-wider">
              In Stock ({product.stock})
            </span>
          </div>

          {/* Editorial Match Reason (AI Agent Chat) */}
          {matchReason && (
            <div className="p-2.5 rounded-xl bg-[#8AA48A]/10 border border-[#8AA48A]/20 text-[10px] text-[#4A5B4A] dark:text-[#C8CDC5] leading-snug mt-1">
              <span className="font-semibold text-[#5E6854] dark:text-[#8AA48A] block mb-0.5">Why I chose this:</span>
              {matchReason}
            </div>
          )}

          {/* Size Selector (if multiple sizes and onSelectSize / selectedSize used) */}
          {product.sizes && product.sizes.length > 1 && !product.sizes.includes('Free Size') && (
            <div className="pt-1.5">
              <span className="text-[9px] uppercase tracking-wider text-text-secondary font-semibold block mb-1">
                Select Size:
              </span>
              <div className="flex flex-wrap gap-1">
                {product.sizes.map((sz) => {
                  const isChosen = activeSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setInternalSize(sz);
                        if (onSelectSize) onSelectSize(sz);
                      }}
                      className={`px-2 py-0.5 text-[10px] rounded-md border font-medium transition-all ${
                        isChosen
                          ? 'bg-[#8AA48A] text-[#2A2A2A] border-[#8AA48A] font-bold shadow-xs'
                          : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A]'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optional Direct Actions Bar (Used in AI Chat for quick access or Selection) */}
      {(showDirectButtons || isSelectable) && (
        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[#E6E2DA]/60 dark:border-[#3E443D]/60">
          {isSelectable ? (
            <button
              type="button"
              onClick={handleQuickViewClick}
              className="flex-1 py-1.5 px-2 text-[11px] rounded-full border border-[#E6E2DA] dark:border-[#3E443D] hover:border-[#2A2A2A] dark:hover:border-[#F6F7F2] text-[#2A2A2A] dark:text-[#F6F7F2] font-medium text-center transition-colors truncate cursor-pointer select-none"
            >
              View details
            </button>
          ) : (
            <Link
              to={`/product/${product.id}`}
              className="flex-1 py-1.5 px-2 text-[11px] rounded-full border border-[#E6E2DA] dark:border-[#3E443D] hover:border-[#2A2A2A] dark:hover:border-[#F6F7F2] text-[#2A2A2A] dark:text-[#F6F7F2] font-medium text-center transition-colors truncate"
            >
              View details
            </Link>
          )}
          {isSelectable ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect();
              }}
              className={`py-1.5 px-3 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#8AA48A] text-[#2A2A2A] shadow-sage font-bold'
                  : 'border border-[#8AA48A] text-[#5E6854] dark:text-[#8AA48A] hover:bg-[#8AA48A]/15'
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>SELECTED</span>
                </>
              ) : (
                <>
                  <span>+ SELECT</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleQuickAdd}
              className="py-1.5 px-3 rounded-full bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] text-[11px] font-semibold flex items-center justify-center gap-1 shadow-sage transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3 h-3" />
              <span>Add to bag</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
