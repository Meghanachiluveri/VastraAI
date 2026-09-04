import React from 'react';
import { cn } from '../../lib/utils';
import { Sparkles } from 'lucide-react';

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center' | 'right';
  isAI?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  isAI = false,
  action,
  className,
}) => {
  const alignments = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  };

  return (
    <div className={cn('flex flex-col mb-10 md:mb-14', alignments[align], className)}>
      {eyebrow && (
        <div className="flex items-center gap-1.5 mb-2.5">
          {isAI && <Sparkles className="w-3.5 h-3.5 text-accent-sage animate-pulse-subtle" />}
          <span
            className={cn(
              'text-xs font-semibold tracking-widest uppercase',
              isAI ? 'text-accent-sage' : 'text-text-secondary'
            )}
          >
            {eyebrow}
          </span>
        </div>
      )}

      <div className={cn('flex flex-col md:flex-row md:items-end justify-between w-full gap-4', align === 'center' && 'justify-center')}>
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-text-primary font-normal tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2.5 text-sm sm:text-base text-text-secondary max-w-2xl font-light leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {action && <div className="flex-shrink-0 pt-2 md:pt-0">{action}</div>}
      </div>
    </div>
  );
};
