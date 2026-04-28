"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function SetupPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/service/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_id: session?.user.googleId,
          email: session?.user.email ?? "",
          display_name: displayName.trim(),
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        setError(body.detail ?? "something went wrong")
        setLoading(false)
        return
      }

      const user = await res.json()
      await update({ userId: user.id, displayName: user.display_name })
      router.push("/")
    } catch {
      setError("something went wrong")
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold">pick your name</h1>
          <p className="text-muted-foreground text-sm mt-1">
            this is what everyone sees. choose wisely.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="display name"
            maxLength={32}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "saving..." : "let's go"}
          </button>
        </form>
      </div>
    </main>
  )
}
