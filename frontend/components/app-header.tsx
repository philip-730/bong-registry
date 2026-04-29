"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export function AppHeader({ displayName }: { displayName?: string }) {
  return (
    <header className="border-b border-border bg-background px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <Image src="/catch-bong-logo.png" alt="bong" width={48} height={48} className="rounded-xl" />
        <div className="flex items-center gap-3">
          {displayName && (
            <span className="text-sm text-muted-foreground">@{displayName}</span>
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
