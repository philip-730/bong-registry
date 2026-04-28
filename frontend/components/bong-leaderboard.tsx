"use client"

import { useState, useEffect } from "react"
import type { LeaderboardEntry } from "@/types/api"

const PERIODS = ["all", "year", "month", "week"] as const
type Period = (typeof PERIODS)[number]
type Sort = "score" | "cosigns"

export function BongLeaderboard() {
  const [period, setPeriod] = useState<Period>("all")
  const [sort, setSort] = useState<Sort>("score")
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/service/leaderboard?period=${period}&sort=${sort}`)
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [period, sort])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                period === p
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "all time" : `this ${p}`}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["score", "cosigns"] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sort === s ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              by {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">no bongs this period.</p>
      ) : (
        <div>
          {entries.map((entry) => (
            <div key={entry.user_id} className="flex items-center gap-4 py-3 border-b border-border">
              <span className="text-muted-foreground text-sm w-6 shrink-0">#{entry.rank}</span>
              <span className="font-medium text-sm flex-1">{entry.display_name}</span>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{entry.bong_count} bongs</span>
                <span>{parseFloat(entry.total_score).toFixed(1)} pts</span>
                <span>{entry.cosign_count} +bongs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
