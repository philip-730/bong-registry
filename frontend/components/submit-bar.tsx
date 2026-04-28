"use client"

import { useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { BongInput, type BongInputHandle } from "@/components/bong-input"
import type { User } from "@/types/api"

export function SubmitBar({ users }: { users: User[] }) {
  const { data: session } = useSession()
  const inputRef = useRef<BongInputHandle>(null)
  const [offense, setOffense] = useState("")
  const [subjects, setSubjects] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")


  const canSubmit = subjects.length > 0 && offense.length > 0 && offense.length <= 300 && !loading

  function handleChange(newOffense: string, newSubjects: User[]) {
    setOffense(newOffense)
    setSubjects(newSubjects)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !session?.user.userId) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/service/bongs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitter_id: session.user.userId,
          subject_ids: subjects.map((s) => s.id),
          offense,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        setError(body.detail ?? "something went wrong")
      } else {
        inputRef.current?.clear()
        setOffense("")
        setSubjects([])
      }
    } catch {
      setError("something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-2xl mx-auto">
        <div className="flex gap-2">
          <BongInput ref={inputRef} users={users} onChange={handleChange} />
          <Button type="submit" disabled={!canSubmit}>
            {loading ? "judging..." : "bong"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </div>
  )
}
