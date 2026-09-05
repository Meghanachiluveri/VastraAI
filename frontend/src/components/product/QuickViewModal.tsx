import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useUIStore } from '../../stores/useUIStore';
import { useCartStore } from '../../stores/useCartStore';
import { formatCurrency } from '../../lib/utils';
import { ShoppingBag, ArrowRight, Star } from 'lucide-react';
import type { Product } from '../../types/types';

export const QuickViewModal: React.FC = () => {
  const { quickViewProduct, closeQuickView } = useUIStore();
  const addItem = useCartStore((state) => state.addItem);

  const product = quickViewProduct as unknown as Product | null;

  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');

  if (!product) return null;

  const activeColor = product.colors[selectedColorIdx] || product.colors[0] || 'Default';
  const activeSize = selectedSize || product.sizes[0] || 'M';

  const handleAddToBag = () => {
    addItem(product, activeColor, activeSize, 1);
    closeQuickView();
  };

  return (
    <Modal
      isOpen={Boolean(product)}
      onClose={closeQuickView}
      maxWidth="3xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Image Showcase */}
        <div className="aspect-[3/4] bg-stone-100 dark:bg-stone-800 rounded-2xl overflow-hidden border border-[#E6E2DA] dark:border-[#3E443D]">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Details & Actions */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="soft-sage">
                {product.category}
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">
                <Star className="w-3 h-3 fill-[#C9A46A] text-[#C9A46A]" />
                {product.rating} ({product.reviewCount} reviews)
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-serif text-text-primary font-medium">
              {product.name}
            </h3>

            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold text-text-primary">
                {formatCurrency(product.price)}
              </span>
              <span className="text-xs text-accent-sage font-medium uppercase tracking-wider">
                In Stock ({product.stock} pieces)
              </span>
            </div>

            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-light">
              {product.description}
            </p>

            {/* Color selection */}
            {product.colors.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                  Color: <span className="text-text-primary font-normal">{activeColor}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c, i) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColorIdx(i)}
                      className={`px-3 py-1 text-xs rounded-full border transition-all ${
                        selectedColorIdx === i
                          ? 'border-[#8AA48A] bg-[#8AA48A] text-[#2A2A2A] font-semibold'
                          : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-primary hover:border-text-primary bg-surface'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size selection */}
            {product.sizes.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                  Select Size:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`px-3.5 py-1.5 text-xs rounded-full border font-medium transition-all ${
                        activeSize === s
                          ? 'border-[#8AA48A] bg-[#CFD8CF] text-[#2A2A2A] font-semibold'
                          : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-primary hover:border-text-primary bg-surface'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-4 border-t border-[#E6E2DA] dark:border-[#3E443D]">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              leftIcon={<ShoppingBag className="w-4 h-4" />}
              onClick={handleAddToBag}
            >
              Add to Shopping Bag
            </Button>

            <div className="text-center">
              <Link
                to={`/product/${product.id}`}
                onClick={closeQuickView}
                className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent-sage uppercase tracking-wider transition-colors"
              >
                <span>View Full Editorial Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </div>

      </div>
    </Modal>
  );
};
