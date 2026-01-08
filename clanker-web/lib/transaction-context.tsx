"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface TransactionState {
  isPending: boolean
  description: string | null
  hash: string | null
}

interface TransactionContextValue {
  transaction: TransactionState
  startTransaction: (description: string) => boolean  // Returns false if already pending
  updateHash: (hash: string) => void
  endTransaction: () => void
  canStartTransaction: () => boolean
}

const TransactionContext = createContext<TransactionContextValue | null>(null)

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transaction, setTransaction] = useState<TransactionState>({
    isPending: false,
    description: null,
    hash: null,
  })

  const startTransaction = useCallback((description: string): boolean => {
    // Don't allow starting a new transaction if one is already pending
    if (transaction.isPending) {
      return false
    }
    setTransaction({
      isPending: true,
      description,
      hash: null,
    })
    return true
  }, [transaction.isPending])

  const updateHash = useCallback((hash: string) => {
    setTransaction(prev => ({ ...prev, hash }))
  }, [])

  const endTransaction = useCallback(() => {
    setTransaction({
      isPending: false,
      description: null,
      hash: null,
    })
  }, [])

  const canStartTransaction = useCallback(() => {
    return !transaction.isPending
  }, [transaction.isPending])

  return (
    <TransactionContext.Provider value={{
      transaction,
      startTransaction,
      updateHash,
      endTransaction,
      canStartTransaction,
    }}>
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransaction() {
  const context = useContext(TransactionContext)
  if (!context) {
    throw new Error("useTransaction must be used within a TransactionProvider")
  }
  return context
}

/**
 * Hook that wraps writeContract to prevent double-transactions
 * Returns a wrapped write function that checks for pending transactions
 */
export function useTransactionGuard() {
  const { startTransaction, updateHash, endTransaction, canStartTransaction, transaction } = useTransaction()
  
  return {
    isPending: transaction.isPending,
    description: transaction.description,
    hash: transaction.hash,
    canStart: canStartTransaction,
    
    /**
     * Wrap a transaction call - returns false if blocked
     */
    guardTransaction: (description: string, execute: () => void): boolean => {
      if (!startTransaction(description)) {
        return false
      }
      execute()
      return true
    },
    
    /**
     * Call when transaction hash is received
     */
    onHash: updateHash,
    
    /**
     * Call when transaction completes (success or error)
     */
    onComplete: endTransaction,
  }
}
