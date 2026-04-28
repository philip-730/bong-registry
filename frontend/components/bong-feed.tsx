"use client"

import { useEffect, useState } from "react"
import { BongCard } from "@/components/bong-card"
import type { Bong } from "@/types/api"

export function BongFeed({ initial, userId }: { initial: Bong[]; userId?: string }) {
  const [bongs, setBongs] = useState<Bong[]>(initial)
  const [cosignedIds, setCosignedIds] = useState<Set<string>>(new Set())
  const [verdictMap, setVerdictMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!userId) return
    fetch(`/service/users/${userId}/cosigns`)
      .then((r) => r.json())
      .then((ids: string[]) => setCosignedIds(new Set(ids)))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    const streamUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? ""}/service/stream`
    const es = new EventSource(streamUrl)
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (event.type === "bong_pending") {
          setBongs((prev) => [event.bong, ...prev])
        } else if (event.type === "verdict_chunk") {
          setVerdictMap((prev) => ({
            ...prev,
            [event.bong_id]: (prev[event.bong_id] ?? "") + event.chunk,
          }))
        } else if (event.type === "bong_complete") {
          setBongs((prev) => prev.map((b) => b.id === event.bong.id ? event.bong : b))
          setVerdictMap((prev) => {
            const next = { ...prev }
            delete next[event.bong.id]
            return next
          })
        }
      } catch {
        // ignore malformed events
      }
    }
    return () => es.close()
  }, [])

  function handleCosignChange(bongId: string, cosigned: boolean) {
    setCosignedIds((prev) => {
      const next = new Set(prev)
      cosigned ? next.add(bongId) : next.delete(bongId)
      return next
    })
  }

  if (bongs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        no bongs yet. catch someone slipping.
      </p>
    )
  }

  return (
    <div>
      {bongs.map((b) => (
        <BongCard
          key={b.id}
          bong={b}
          userId={userId}
          cosigned={cosignedIds.has(b.id)}
          onCosignChange={handleCosignChange}
          streamingVerdict={verdictMap[b.id]}
        />
      ))}
    </div>
  )
}
