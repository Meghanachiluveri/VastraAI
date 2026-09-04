import { useState, useEffect } from 'react';

export function useScrollElevation(threshold: number = 20): boolean {
  const [isElevated, setIsElevated] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      setIsElevated(offset > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  return isElevated;
}
