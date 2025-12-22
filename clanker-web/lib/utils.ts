import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatEther } from "viem"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const UI_CONSTANTS = {
  padding: "p-3.5",
  gap: "gap-3.5",
  spaceY: "space-y-3.5",
  rounded: "rounded-xl",
} as const;

export function formatTokenAmount(amount: bigint | undefined, decimals: number = 4): string {
  if (amount === undefined || amount === 0n) return '0.00';
  const formatted = formatEther(amount);
  const [whole, decimal] = formatted.split('.');
  if (!decimal) return `${whole}.00`;

  // If we have a whole number part, just stick to fixed decimals
  if (whole !== '0') {
    return `${whole}.${decimal.slice(0, decimals)}`;
  }

  // If it's a small number (0.xxxxx)
  // Check if standard truncation would result in 0 (and the number isn't actually 0)
  const standard = decimal.slice(0, decimals);
  // If standard view is all zeros (e.g. "0000") but we have value
  if (/^0+$/.test(standard) && amount > 0n) {
    // Find first non-zero digit
    const firstNonZeroIndex = decimal.split('').findIndex(c => c !== '0');
    if (firstNonZeroIndex === -1) return '0';
    
    // Show up to the first non-zero digit + 1 extra digit for context
    // e.g. 0.0000234 -> show 0.000023
    return `${whole}.${decimal.slice(0, firstNonZeroIndex + 2)}`;
  }

  return `${whole}.${decimal.slice(0, decimals)}`;
}
