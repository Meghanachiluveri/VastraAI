import React from 'react';
import { cn } from '../../lib/utils';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  size = 'lg',
  className,
  children,
  ...props
}) => {
  const maxWidths = {
    sm: 'max-w-4xl',
    md: 'max-w-6xl',
    lg: 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8',
        maxWidths[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
