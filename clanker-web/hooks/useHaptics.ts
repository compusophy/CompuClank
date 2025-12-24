'use client';

import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/lib/haptics';

/**
 * React hook for sacred geometry golden ratio haptics
 * 
 * Provides haptic feedback methods that can be called from components.
 * Automatically checks for support and gracefully degrades.
 */
export function useHaptics() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    haptics.isSupported().then(setIsSupported);
  }, []);

  // Memoized haptic callbacks for performance
  const buttonPress = useCallback(() => haptics.buttonPress(), []);
  const buttonRelease = useCallback(() => haptics.buttonRelease(), []);
  const heavyAction = useCallback(() => haptics.heavyAction(), []);
  const selection = useCallback(() => haptics.selection(), []);
  const cardTap = useCallback(() => haptics.cardTap(), []);
  const modalOpen = useCallback(() => haptics.modalOpen(), []);
  const modalClose = useCallback(() => haptics.modalClose(), []);
  const success = useCallback(() => haptics.success(), []);
  const warning = useCallback(() => haptics.warning(), []);
  const error = useCallback(() => haptics.error(), []);
  const scrollTick = useCallback(() => haptics.scrollTick(), []);
  const goldenPulse = useCallback(() => haptics.goldenPulse(), []);
  const sacredRhythm = useCallback(() => haptics.sacredRhythm(), []);

  return {
    isSupported,
    // Common interactions
    buttonPress,
    buttonRelease,
    heavyAction,
    selection,
    cardTap,
    // Modal interactions
    modalOpen,
    modalClose,
    // Feedback
    success,
    warning,
    error,
    // Special
    scrollTick,
    goldenPulse,
    sacredRhythm,
    // Raw access
    impact: haptics.impact,
    notification: haptics.notification,
  };
}

export default useHaptics;
