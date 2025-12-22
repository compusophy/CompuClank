"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { WalletButton } from "@/components/wallet/WalletButton"
import { SettingsModal } from "@/components/SettingsModal"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CabalDetailsContent } from "@/components/CabalDetailsContent"

export default function CabalDetailPage() {
  const params = useParams()
  const cabalId = BigInt(params.id as string)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="page-container">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="text-xl font-bold tracking-tight">
              CABAL
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/create">
                <Button size="sm" className="gap-1.5 shadow-sm">
                  <Plus className="h-4 w-4" />
                  <span>Create</span>
                </Button>
              </Link>
              <WalletButton />
              <SettingsModal />
            </div>
          </div>
        </div>
      </header>

      <main className="page-container py-3.5 space-y-3.5">
        <CabalDetailsContent cabalId={cabalId} />
      </main>
    </div>
  )
}
