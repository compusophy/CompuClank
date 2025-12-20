import { formatTokenAmount } from "@/lib/utils";

interface TokenAmountProps {
  amount: bigint | undefined;
  symbol?: string;
  decimals?: number;
  className?: string;
}

export function TokenAmount({ amount, symbol, decimals = 4, className }: TokenAmountProps) {
  return (
    <span className={className}>
      {formatTokenAmount(amount, decimals)}{symbol ? ` ${symbol}` : ''}
    </span>
  );
}
