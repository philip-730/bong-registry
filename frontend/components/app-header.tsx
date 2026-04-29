"use client"

import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

export function AppHeader() {
  const { data: session } = useSession()
  const displayName = session?.user.displayName

  return (
    <header className="border-b border-border bg-background px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <Link href="/"><Image src="/catch-bong-logo.png" alt="bong" width={48} height={48} className="rounded-xl" /></Link>
        <div className="flex items-center gap-3">
          {displayName && (
            <Link href="/users" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              @{displayName}
            </Link>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
