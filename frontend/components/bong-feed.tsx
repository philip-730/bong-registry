"use client"

import { useEffect, useRef, useState } from "react"
import { BongCard } from "@/components/bong-card"
import type { Bong, User } from "@/types/api"

type FilterType = "all" | "by" | "on"

function matchesFilter(bong: Bong, filter: FilterType, filterUserId: string): boolean {
  if (filter === "all") return true
  if (filter === "by") return bong.submitter.id === filterUserId
  return bong.subjects.some((s) => s.id === filterUserId)
}

export function BongFeed({ initial, userId, users }: { initial: Bong[]; userId?: string; users: User[] }) {
  const [bongs, setBongs] = useState<Bong[]>(initial)
  const [cosignedIds, setCosignedIds] = useState<Set<string>>(new Set())
  const [verdictMap, setVerdictMap] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<FilterType>("all")
  const [filterUserId, setFilterUserId] = useState<string>(userId ?? users[0]?.id ?? "")
  const filterRef = useRef<{ filter: FilterType; filterUserId: string }>({ filter: "all", filterUserId: filterUserId })
  const skipInitialFetch = useRef(true)

  useEffect(() => {
    filterRef.current = { filter, filterUserId }
  }, [filter, filterUserId])

  useEffect(() => {
    if (skipInitialFetch.current && filter === "all") {
      skipInitialFetch.current = false
      return
    }
    skipInitialFetch.current = false
    const params = new URLSearchParams()
    if (filter === "by" && filterUserId) params.set("submitter_id", filterUserId)
    if (filter === "on" && filterUserId) params.set("subject_id", filterUserId)
    const query = params.size ? `?${params}` : ""
    fetch(`/service/bongs${query}`)
      .then((r) => r.json())
      .then(setBongs)
      .catch(() => {})
  }, [filter, filterUserId])

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
        const { filter, filterUserId } = filterRef.current
        if (event.type === "bong_pending") {
          if (matchesFilter(event.bong, filter, filterUserId)) {
            setBongs((prev) => [event.bong, ...prev])
          }
        } else if (event.type === "verdict_chunk") {
          setVerdictMap((prev) => ({
            ...prev,
            [event.bong_id]: (prev[event.bong_id] ?? "") + event.chunk,
          }))
        } else if (event.type === "bong_complete") {
          setBongs((prev) => prev.map((b) => (b.id === event.bong.id ? event.bong : b)))
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {(["all", "by", "on"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "all" : f === "by" ? "caught by" : "caught on"}
          </button>
        ))}
        {filter !== "all" && (
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="text-xs bg-muted text-foreground border border-border rounded-full px-3 py-1 font-mono"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {bongs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          no bongs yet. catch someone slipping.
        </p>
      ) : (
        bongs.map((b) => (
          <BongCard
            key={b.id}
            bong={b}
            users={users}
            userId={userId}
            cosigned={cosignedIds.has(b.id)}
            onCosignChange={handleCosignChange}
            streamingVerdict={verdictMap[b.id]}
          />
        ))
      )}
    </div>
  )
}
