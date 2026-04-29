"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function UserRename({ userId, currentName }: { userId: string; currentName: string }) {
  const { update } = useSession()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(currentName)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!name.trim() || name.trim() === currentName) { setEditing(false); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/service/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.detail ?? "something went wrong")
        return
      }
      const user = await res.json()
      await update({ userId: user.id, displayName: user.display_name })
      setEditing(false)
    } catch {
      setError("something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-fit text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        update display name
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-1">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
          maxLength={32}
          className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="xs" onClick={handleSave} disabled={loading}>save</Button>
        <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>cancel</Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
