import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '../../types/types';
import { ProductCard } from './ProductCard';
import { LoadingState } from '../common/LoadingState';
import { Button } from '../common/Button';
import { ShoppingBag, RotateCcw } from 'lucide-react';

export interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onClearFilters?: () => void;
  columns?: 2 | 3 | 4;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'No pieces matched your selection.',
  emptyDescription = 'Try adjusting your filters or clear them to view the complete atelier collection.',
  onClearFilters,
  columns = 4,
}) => {
  if (isLoading) {
    return <LoadingState type="grid" count={columns * 2} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-[#E6E2DA] dark:border-[#3E443D] rounded-3xl bg-[#FCFCF9]/50 dark:bg-[#343833]/50 max-w-lg mx-auto my-12 space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] flex items-center justify-center text-[#8AA48A]">
          <RotateCcw className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-serif text-text-primary font-normal">
            Vastra's collection is temporarily unavailable.
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-light">
            {error || 'Unable to connect to the backend catalog service. Please verify your connection.'}
          </p>
        </div>
        {onRetry && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-[#E6E2DA] dark:border-[#3E443D] rounded-3xl bg-[#FCFCF9]/50 dark:bg-[#343833]/50 max-w-lg mx-auto my-12 space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] flex items-center justify-center text-[#8AA48A]">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-serif text-text-primary font-normal">
            {emptyTitle}
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-light">
            {emptyDescription}
          </p>
        </div>
        {onClearFilters && (
          <Button
            variant="primary"
            size="sm"
            onClick={onClearFilters}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <motion.div
      layout
      className={`grid gap-x-6 gap-y-10 ${columnClasses[columns]}`}
    >
      <AnimatePresence>
        {products.map((product) => (
          <motion.div
            key={product.id}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};
