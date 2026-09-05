import React from 'react';
import { cn } from '../../lib/utils';

export interface LoadingStateProps {
  type?: 'grid' | 'detail' | 'spinner' | 'editorial';
  count?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'grid',
  count = 4,
  className,
}) => {
  if (type === 'spinner') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
        <div className="w-8 h-8 border-2 border-border border-t-[#8AA48A] rounded-full animate-spin" />
        <span className="text-xs uppercase tracking-widest text-text-secondary">Curation in progress...</span>
      </div>
    );
  }

  if (type === 'grid') {
    return (
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex flex-col space-y-3 animate-pulse">
            <div className="w-full aspect-[3/4] bg-stone-200/60 dark:bg-stone-800/60 rounded-xs" />
            <div className="h-4 bg-stone-200/60 dark:bg-stone-800/60 w-3/4 rounded-xs" />
            <div className="h-3 bg-stone-200/40 dark:bg-stone-800/40 w-1/2 rounded-xs" />
            <div className="h-4 bg-stone-200/60 dark:bg-stone-800/60 w-1/4 rounded-xs" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'detail') {
    return (
      <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-12 py-8 animate-pulse', className)}>
        <div className="w-full aspect-[3/4] bg-stone-200/60 dark:bg-stone-800/60 rounded-xs" />
        <div className="space-y-6">
          <div className="h-8 bg-stone-200/60 dark:bg-stone-800/60 w-3/4 rounded-xs" />
          <div className="h-4 bg-stone-200/40 dark:bg-stone-800/40 w-1/3 rounded-xs" />
          <div className="h-6 bg-stone-200/60 dark:bg-stone-800/60 w-1/4 rounded-xs" />
          <div className="space-y-2 pt-4">
            <div className="h-4 bg-stone-200/40 dark:bg-stone-800/40 w-full rounded-xs" />
            <div className="h-4 bg-stone-200/40 dark:bg-stone-800/40 w-5/6 rounded-xs" />
          </div>
        </div>
      </div>
    );
  }

  return null;
};
