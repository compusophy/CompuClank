"use client"

import { useTransaction } from "@/lib/transaction-context"
import { Loader2 } from "lucide-react"

/**
 * Global transaction status indicator
 * Shows a floating indicator when a transaction is pending
 */
export function TransactionStatus() {
  const { transaction } = useTransaction()
  
  if (!transaction.isPending) return null
  
  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-background/95 border border-primary/40 px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-sm font-medium">
        {transaction.description || "Transaction pending..."}
      </span>
      {transaction.hash && (
        <a
          href={`https://basescan.org/tx/${transaction.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          View
        </a>
      )}
    </div>
  )
}
