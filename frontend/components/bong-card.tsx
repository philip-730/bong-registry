"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Bong } from "@/types/api"

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
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface BongCardProps {
  bong: Bong
  userId?: string
  cosigned?: boolean
  onCosignChange?: (bongId: string, cosigned: boolean) => void
  streamingVerdict?: string
}

export function BongCard({ bong, userId, cosigned = false, onCosignChange, streamingVerdict }: BongCardProps) {
  const [isCosigned, setIsCosigned] = useState(cosigned)
  const [cosignCount, setCosignCount] = useState(bong.cosign_count)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setIsCosigned(cosigned)
  }, [cosigned])

  const isPending = bong.score === null
  const isStreaming = streamingVerdict !== undefined
  const verdictText = isStreaming ? streamingVerdict : bong.llm_response
  const subjects = bong.subjects.map((s) => s.display_name).join(", ")
  const tierClass = bong.tier ? (tierColors[bong.tier.toLowerCase()] ?? "bg-muted text-muted-foreground") : ""

  async function handleCosign() {
    if (!userId || loading) return
    setLoading(true)
    try {
      if (isCosigned) {
        const res = await fetch(`/service/bongs/${bong.id}/cosign?user_id=${userId}`, { method: "DELETE" })
        if (res.ok) {
          setIsCosigned(false)
          setCosignCount((c) => c - 1)
          onCosignChange?.(bong.id, false)
        }
      } else {
        const res = await fetch(`/service/bongs/${bong.id}/cosign?user_id=${userId}`, { method: "POST" })
        if (res.ok) {
          setIsCosigned(true)
          setCosignCount((c) => c + 1)
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
          <div className="text-sm">
            <span className="text-muted-foreground">{bong.submitter.display_name}</span>
            <span className="text-muted-foreground"> caught a bong on </span>
            <span className="font-medium">{subjects}</span>
          </div>
          <p className="text-sm">{bong.offense}</p>
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
        <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
          {verdictText}
          {isStreaming && <span className="animate-pulse">▌</span>}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{timeAgo(bong.created_at)}</span>
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
  )
}
