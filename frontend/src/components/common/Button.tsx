import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'sage' | 'outline' | 'ghost' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium tracking-wide transition-all duration-250 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none rounded-full group';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-[#8AA48A] text-[#2A2A2A] hover:bg-[#758E75] shadow-sage focus-visible:ring-[#8AA48A]',
      sage:
        'bg-[#8AA48A] text-[#2A2A2A] hover:bg-[#758E75] shadow-sage focus-visible:ring-[#8AA48A]',
      secondary:
        'bg-transparent border border-[#E6E2DA] dark:border-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] hover:bg-[#CFD8CF]/60 dark:hover:bg-[#343833]',
      outline:
        'border border-[#E6E2DA] text-[#2A2A2A] dark:text-[#F6F7F2] hover:border-[#2A2A2A] hover:bg-[#CFD8CF]/40',
      ghost:
        'text-text-secondary hover:text-text-primary hover:bg-[#CFD8CF]/40',
      gold:
        'bg-[#C9A46A] text-[#2A2A2A] hover:bg-[#B59157] shadow-soft',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'text-xs px-4 py-2 gap-1.5 uppercase tracking-editorial',
      md: 'text-xs sm:text-sm px-6 py-2.5 gap-2 uppercase tracking-editorial',
      lg: 'text-sm sm:text-base px-8 py-3.5 gap-2.5 tracking-wider',
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0 group-hover:translate-x-1 transition-transform duration-250">
            {rightIcon}
          </span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
