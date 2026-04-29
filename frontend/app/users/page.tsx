import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { authOptions } from "@/auth"
import { AppHeader } from "@/components/app-header"
import { UserRename } from "@/components/user-rename"
import type { User } from "@/types/api"

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000"

const avatarColors = [
  "bg-mauve/30 text-mauve",
  "bg-teal/30 text-teal",
  "bg-blue/30 text-blue",
  "bg-chart-2/30 text-chart-2",
  "bg-chart-4/30 text-chart-4",
]

function avatarColor(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  return avatarColors[n % avatarColors.length]
}

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/auth/signin")

  const res = await fetch(`${BACKEND}/service/users`, { cache: "no-store" })
  const users: User[] = res.ok ? await res.json() : []

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        <h1 className="text-lg font-semibold">users</h1>
        <p className="text-sm text-muted-foreground mb-4">all the bong brains you can catch bongs on including you</p>
        <div className="flex flex-col divide-y divide-border">
          {users.map((user) => {
            const isMe = user.id === session.user.userId
            return (
              <div key={user.id} className={`flex gap-3 py-3 ${isMe ? "items-start" : "items-center"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${avatarColor(user.id)}`}>
                  {user.display_name[0].toUpperCase()}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    @{user.display_name}
                    {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </span>
                  {isMe && (
                    <UserRename userId={user.id} currentName={user.display_name} />
                  )}
                </div>
                <span className="text-xs text-teal shrink-0">
                  joined {new Date(user.created_at + "Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
