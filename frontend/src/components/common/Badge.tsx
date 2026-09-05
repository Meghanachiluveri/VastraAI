import React from 'react';
import { cn } from '../../lib/utils';
import { Sparkles } from 'lucide-react';

export type BadgeVariant = 'sage' | 'soft-sage' | 'gold' | 'outline' | 'cream' | 'espresso';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'soft-sage',
  children,
  className,
  icon = false,
}) => {
  const variants: Record<BadgeVariant, string> = {
    sage:
      'bg-[#8AA48A]/20 text-[#4A5B4A] dark:text-[#8AA48A] border border-[#8AA48A]/40',
    'soft-sage':
      'bg-[#CFD8CF]/80 text-[#2A2A2A] dark:bg-[#3E443D] dark:text-[#F6F7F2] border border-[#B2C4B2]/40',
    gold:
      'bg-[#C9A46A]/15 text-[#8F6C35] dark:text-[#C9A46A] border border-[#C9A46A]/35',
    cream:
      'bg-[#F6F7F2] text-[#2A2A2A] border border-[#E6E2DA] dark:bg-[#343833] dark:text-[#F6F7F2]',
    espresso:
      'bg-[#2A2A2A] text-[#F6F7F2] border border-[#2A2A2A] dark:bg-[#3E443D] dark:text-[#F6F7F2]',
    outline:
      'border border-[#E6E2DA] text-text-secondary bg-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium tracking-editorial uppercase rounded-full select-none',
        variants[variant],
        className
      )}
    >
      {icon && <Sparkles className="w-3 h-3 text-[#8AA48A]" />}
      {children}
    </span>
  );
};
