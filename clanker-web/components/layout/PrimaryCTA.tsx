'use client';

import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

interface PrimaryCTAProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Golden ratio: 61.803%
export const GOLDEN_RATIO_WIDTH = 'w-[61.803%]';

export function PrimaryCTA({ children, onClick, disabled, className = '' }: PrimaryCTAProps) {
  return (
    <div className="fixed bottom-[70px] left-0 right-0 z-40 pointer-events-none">
      <div className="page-container h-14 flex items-center justify-center">
        <Button
          onClick={onClick}
          disabled={disabled}
          variant="golden"
          size="lg"
          haptic="golden"
          className={`${GOLDEN_RATIO_WIDTH} h-12 text-base pointer-events-auto ${className}`}
        >
          {children}
        </Button>
      </div>
    </div>
  );
}
