import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { ShoppingBag, Sparkles } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isAI?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  isAI = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-border rounded-xl bg-surface/40 max-w-md mx-auto my-8',
        className
      )}
    >
      <div
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center mb-4',
          isAI
            ? 'bg-accent-sage-soft text-accent-sage'
            : 'bg-stone-200/60 dark:bg-stone-800/80 text-text-secondary'
        )}
      >
        {icon || (isAI ? <Sparkles className="w-6 h-6 text-accent-sage" /> : <ShoppingBag className="w-6 h-6" />)}
      </div>

      <h3 className="text-xl font-serif text-text-primary mb-2 font-normal">
        {title}
      </h3>

      <p className="text-sm text-text-secondary mb-6 font-light leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button
          variant={isAI ? 'sage' : 'primary'}
          size="sm"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
