/**
 * Sacred Geometry Golden Ratio Haptics
 * 
 * Haptic feedback patterns inspired by the golden ratio (φ = 1.618)
 * for a harmonious, satisfying user experience.
 */

import { sdk } from '@farcaster/miniapp-sdk';

// Golden ratio constant
const PHI = 1.618033988749;
const PHI_INV = 0.618033988749;

// Golden ratio timing intervals (ms)
export const HAPTIC_TIMING = {
  instant: 0,
  micro: Math.round(16 * PHI_INV),      // ~10ms - subtle
  swift: Math.round(50 * PHI_INV),       // ~31ms - quick
  natural: Math.round(100 * PHI_INV),    // ~62ms - natural feel
  breath: Math.round(200 * PHI_INV),     // ~124ms - breathing rhythm
  pulse: Math.round(300 * PHI_INV),      // ~185ms - heartbeat
  wave: Math.round(500 * PHI_INV),       // ~309ms - flowing
} as const;

// Haptic intensity patterns based on Fibonacci
type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
type NotificationStyle = 'success' | 'warning' | 'error';

// Cache for capability check
let hapticsSupported: boolean | null = null;
let hapticsCapabilities: {
  impact: boolean;
  notification: boolean;
  selection: boolean;
} | null = null;

/**
 * Check if haptics are supported
 */
async function checkHapticsSupport(): Promise<boolean> {
  if (hapticsSupported !== null) return hapticsSupported;
  
  try {
    const isInMiniApp = await sdk.isInMiniApp();
    if (!isInMiniApp) {
      hapticsSupported = false;
      return false;
    }
    
    const capabilities = await sdk.getCapabilities();
    hapticsCapabilities = {
      impact: capabilities.includes('haptics.impactOccurred'),
      notification: capabilities.includes('haptics.notificationOccurred'),
      selection: capabilities.includes('haptics.selectionChanged'),
    };
    hapticsSupported = hapticsCapabilities.impact || 
                       hapticsCapabilities.notification || 
                       hapticsCapabilities.selection;
    return hapticsSupported;
  } catch {
    hapticsSupported = false;
    return false;
  }
}

/**
 * Sacred haptic patterns for different interactions
 */
export const haptics = {
  /**
   * Button press - Light tap with golden feel
   * Use for: Primary buttons, CTAs, action buttons
   */
  async buttonPress(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('light');
    }
  },

  /**
   * Button release - Soft confirmation
   * Use for: Button release after press
   */
  async buttonRelease(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('soft');
    }
  },

  /**
   * Heavy action - Strong feedback for important actions
   * Use for: Submit, confirm, significant state changes
   */
  async heavyAction(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('heavy');
    }
  },

  /**
   * Selection change - Subtle tick
   * Use for: Tab switches, filter changes, toggles
   */
  async selection(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.selection) {
      await sdk.haptics.selectionChanged();
    } else if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('light');
    }
  },

  /**
   * Card tap - Medium feedback for card interactions
   * Use for: Cabal cards, list items, interactive cards
   */
  async cardTap(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('medium');
    }
  },

  /**
   * Modal open - Rigid snap for modal appearance
   * Use for: Opening dialogs, modals, sheets
   */
  async modalOpen(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('rigid');
    }
  },

  /**
   * Modal close - Soft dismissal
   * Use for: Closing dialogs, modals, sheets
   */
  async modalClose(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('soft');
    }
  },

  /**
   * Success - Celebratory feedback
   * Use for: Transaction success, creation success, achievements
   */
  async success(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.notification) {
      await sdk.haptics.notificationOccurred('success');
    } else if (hapticsCapabilities?.impact) {
      // Golden ratio success pattern: light, pause, medium
      await sdk.haptics.impactOccurred('light');
      await delay(HAPTIC_TIMING.natural);
      await sdk.haptics.impactOccurred('medium');
    }
  },

  /**
   * Warning - Attention-getting feedback
   * Use for: Warnings, important notices
   */
  async warning(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.notification) {
      await sdk.haptics.notificationOccurred('warning');
    } else if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred('rigid');
    }
  },

  /**
   * Error - Alert feedback
   * Use for: Errors, failures, invalid actions
   */
  async error(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.notification) {
      await sdk.haptics.notificationOccurred('error');
    } else if (hapticsCapabilities?.impact) {
      // Double tap for error
      await sdk.haptics.impactOccurred('heavy');
      await delay(HAPTIC_TIMING.swift);
      await sdk.haptics.impactOccurred('heavy');
    }
  },

  /**
   * Scroll tick - Subtle feedback for scroll positions
   * Use for: Reaching scroll boundaries, snap points
   */
  async scrollTick(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.selection) {
      await sdk.haptics.selectionChanged();
    }
  },

  /**
   * Golden pulse - Sacred geometry pattern
   * Use for: Special moments, golden achievements
   */
  async goldenPulse(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      // Fibonacci-inspired pattern: 1, 1, 2
      await sdk.haptics.impactOccurred('soft');
      await delay(HAPTIC_TIMING.natural);
      await sdk.haptics.impactOccurred('soft');
      await delay(HAPTIC_TIMING.breath);
      await sdk.haptics.impactOccurred('medium');
    }
  },

  /**
   * Sacred rhythm - Extended pattern for celebrations
   * Use for: Major achievements, launches, celebrations
   */
  async sacredRhythm(): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.notification) {
      await sdk.haptics.notificationOccurred('success');
      await delay(HAPTIC_TIMING.wave);
      await sdk.haptics.notificationOccurred('success');
    } else if (hapticsCapabilities?.impact) {
      // Golden ratio crescendo: light → medium → heavy
      await sdk.haptics.impactOccurred('light');
      await delay(HAPTIC_TIMING.micro);
      await sdk.haptics.impactOccurred('medium');
      await delay(HAPTIC_TIMING.swift);
      await sdk.haptics.impactOccurred('heavy');
    }
  },

  /**
   * Raw impact - Direct access to impact haptics
   */
  async impact(style: ImpactStyle = 'medium'): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.impact) {
      await sdk.haptics.impactOccurred(style);
    }
  },

  /**
   * Raw notification - Direct access to notification haptics
   */
  async notification(style: NotificationStyle = 'success'): Promise<void> {
    if (!await checkHapticsSupport()) return;
    if (hapticsCapabilities?.notification) {
      await sdk.haptics.notificationOccurred(style);
    }
  },

  /**
   * Check if haptics are supported
   */
  async isSupported(): Promise<boolean> {
    return checkHapticsSupport();
  },
};

// Utility delay function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default haptics;
