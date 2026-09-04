import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { drawerRightVariants, drawerLeftVariants, backdropVariants } from '../../lib/motion';
import { cn } from '../../lib/utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  side?: 'left' | 'right';
  width?: 'sm' | 'md' | 'lg' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  side = 'right',
  width = 'md',
  children,
  footer,
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full',
  };

  const variants = side === 'right' ? drawerRightVariants : drawerLeftVariants;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <motion.div
            variants={variants}
            initial="closed"
            animate="open"
            exit="closed"
            role="dialog"
            aria-modal="true"
            className={cn(
              'fixed top-0 bottom-0 z-50 flex flex-col w-full bg-surface border-border shadow-elevated overflow-hidden',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              widthClasses[width],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/80 flex-shrink-0">
              {title ? (
                <h3 className="text-lg font-serif text-text-primary tracking-tight font-medium">
                  {title}
                </h3>
              ) : (
                <div />
              )}

              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="text-text-secondary hover:text-text-primary p-1.5 rounded-sm hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-1 focus:ring-[#8AA48A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

            {/* Optional Sticky Footer */}
            {footer && (
              <div className="p-6 border-t border-border/80 bg-surface/90 backdrop-blur-xs flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
