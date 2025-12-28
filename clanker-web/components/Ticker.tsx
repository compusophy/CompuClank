import { cn } from "@/lib/utils"

interface TickerProps {
  symbol: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
}

/**
 * Unified ticker display component.
 * Single source of truth for displaying token symbols like $CABAL.
 */
export function Ticker({ symbol, size = "lg", className }: TickerProps) {
  return (
    <span className={cn("inline-flex items-baseline font-mono font-bold tracking-tight", sizeClasses[size], className)}>
      <span>$</span>
      <span className="ml-0.5">{symbol}</span>
    </span>
  )
}
