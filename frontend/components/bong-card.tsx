"use client"

import React, { useState, useEffect, useRef } from "react"
import { Eye, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Bong, User } from "@/types/api"

const tierColors: Record<string, string> = {
  "not that bong": "bg-muted text-muted-foreground",
  "kinda bong": "bg-chart-4/20 text-chart-4",
  "mini bong": "bg-chart-4/20 text-chart-4",
  "semi bong": "bg-chart-2/20 text-chart-2",
  "half bong": "bg-chart-2/20 text-chart-2",
  "three quarters bong": "bg-destructive/15 text-destructive",
  "mega bong": "bg-destructive/15 text-destructive",
  "od bong": "bg-destructive/20 text-destructive",
  "oddd bong": "bg-primary/20 text-primary",
  "bong bong bong": "bg-primary/30 text-primary",
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr + "Z").getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface BongCardProps {
  bong: Bong
  users: User[]
  userId?: string
  cosigned?: boolean
  onCosignChange?: (bongId: string, cosigned: boolean) => void
  streamingVerdict?: string
}

export function BongCard({ bong, users, userId, cosigned = false, onCosignChange, streamingVerdict }: BongCardProps) {
  const [isCosigned, setIsCosigned] = useState(cosigned)
  const [cosignCount, setCosignCount] = useState(bong.cosign_count)
  const [loading, setLoading] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const [cosigners, setCosigners] = useState<{ display_name: string }[] | null>(null)
  const wasStreaming = useRef(false)

  useEffect(() => {
    setIsCosigned(cosigned)
  }, [cosigned])

  useEffect(() => {
    if (wasStreaming.current && streamingVerdict === undefined) {
      setFlashing(true)
      const t = setTimeout(() => setFlashing(false), 800)
      return () => clearTimeout(t)
    }
    wasStreaming.current = streamingVerdict !== undefined
  }, [streamingVerdict])

  const isPending = bong.score === null
  const isStreaming = streamingVerdict !== undefined
  const verdictText = isStreaming ? streamingVerdict : bong.llm_response
  const subjects = bong.subjects.map((s) => s.display_name).join(", ")

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.display_name]))

  function renderTokens() {
    return bong.offense_tokens.map((token, i) => {
      if (token.type === "text") {
        return <React.Fragment key={i}>{token.value}</React.Fragment>
      }
      const name = userMap[token.user_id!] ?? "someone"
      return (
        <span key={i} className="text-primary font-medium">
          @{name}
        </span>
      )
    })
  }

  const tierClass = bong.tier ? (tierColors[bong.tier.toLowerCase()] ?? "bg-muted text-muted-foreground") : ""

  async function handleViewCosigners() {
    if (cosigners) return
    const res = await fetch(`/service/bongs/${bong.id}/cosigns`)
    if (res.ok) setCosigners(await res.json())
  }

  async function handleCosign() {
    if (!userId || loading) return
    setLoading(true)
    try {
      const currentUser = users.find((u) => u.id === userId)
      if (isCosigned) {
        const res = await fetch(`/service/bongs/${bong.id}/cosign?user_id=${userId}`, { method: "DELETE" })
        if (res.ok) {
          setIsCosigned(false)
          setCosignCount((c) => c - 1)
          setCosigners((prev) => prev ? prev.filter((u) => u.display_name !== currentUser?.display_name) : null)
          onCosignChange?.(bong.id, false)
        }
      } else {
        const res = await fetch(`/service/bongs/${bong.id}/cosign?user_id=${userId}`, { method: "POST" })
        if (res.ok) {
          setIsCosigned(true)
          setCosignCount((c) => c + 1)
          if (currentUser) setCosigners((prev) => [...(prev ?? []), { display_name: currentUser.display_name }])
          onCosignChange?.(bong.id, true)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-teal">{bong.submitter.display_name}</span>
            <span> caught a bong on </span>
            <span className="font-medium text-primary">{subjects}</span>
          </div>
          <div className="p-px rounded-lg bg-gradient-to-r from-teal to-blue mt-0.5">
            <p className="text-sm bg-background rounded-[calc(0.5rem-1px)] px-2 py-1">{renderTokens()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPending ? (
            <>
              <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-6 rounded bg-muted animate-pulse" />
            </>
          ) : (
            <>
              <Badge className={cn("text-xs capitalize", tierClass)}>{bong.tier}</Badge>
              <span className="text-xs text-muted-foreground">{parseFloat(bong.score!).toFixed(1)}</span>
            </>
          )}
        </div>
      </div>

      {(isStreaming || verdictText) && (
        <p className={`text-xs text-muted-foreground flex gap-1.5 items-start px-1 rounded ${flashing ? "animate-verdict-flash" : ""}`}>
          <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{verdictText}{isStreaming && <span className="animate-pulse">▌</span>}</span>
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{timeAgo(bong.created_at)}</span>
        <div className="flex items-center gap-1.5">
          {cosignCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button onClick={handleViewCosigners} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="top" align="end">
                <div className="flex flex-col gap-0.5">
                  {cosigners
                    ? cosigners.map((u) => (
                        <p key={u.display_name} className="text-xs text-muted-foreground">@{u.display_name}</p>
                      ))
                    : <p className="text-xs text-muted-foreground">loading...</p>}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button
            variant="outline"
            size="xs"
            onClick={handleCosign}
            disabled={loading || isPending}
            className={isCosigned ? "border-primary text-primary" : ""}
          >
            {isCosigned ? `bong ${cosignCount}` : cosignCount > 0 ? `+bong ${cosignCount}` : "+bong"}
          </Button>
        </div>
      </div>
    </div>
  )
}
