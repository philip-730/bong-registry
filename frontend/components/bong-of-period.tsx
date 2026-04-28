"use client"

import { useState, useEffect } from "react"
import { BongCard } from "@/components/bong-card"
import type { Bong } from "@/types/api"

const PERIODS = ["week", "month", "year"] as const
type Period = (typeof PERIODS)[number]

export function BongOfPeriod({ userId }: { userId?: string }) {
  const [period, setPeriod] = useState<Period>("week")
  const [bong, setBong] = useState<Bong | null>(null)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [cosigned, setCosigned] = useState(false)

  useEffect(() => {
    setLoading(true)
    setEmpty(false)
    setCosigned(false)
    fetch(`/service/bong-of-the-period?period=${period}`)
      .then((r) => {
        if (r.status === 404) { setEmpty(true); return null }
        return r.json()
      })
      .then((data: Bong | null) => {
        if (!data) return
        setBong(data)
        if (userId) {
          fetch(`/service/users/${userId}/cosigns`)
            .then((r) => r.json())
            .then((ids: string[]) => setCosigned(ids.includes(data.id)))
            .catch(() => {})
        }
      })
      .finally(() => setLoading(false))
  }, [period, userId])

  return (
    <div className="flex flex-col gap-4">
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
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">loading...</p>
      ) : empty || !bong ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          no bongs this {period} yet.
        </p>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-2">bong of the {period}</p>
          <BongCard
            bong={bong}
            userId={userId}
            cosigned={cosigned}
            onCosignChange={(_, c) => setCosigned(c)}
          />
        </div>
      )}
    </div>
  )
}
