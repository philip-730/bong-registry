import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { authOptions } from "@/auth"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BongFeed } from "@/components/bong-feed"
import { BongLeaderboard } from "@/components/bong-leaderboard"
import { BongOfPeriod } from "@/components/bong-of-period"
import { SubmitBar } from "@/components/submit-bar"
import { AppHeader } from "@/components/app-header"
import type { Bong, User } from "@/types/api"

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000"

async function getData() {
  const [bongsRes, usersRes] = await Promise.all([
    fetch(`${BACKEND}/service/bongs`, { cache: "no-store" }),
    fetch(`${BACKEND}/service/users`, { cache: "no-store" }),
  ])

  const bongs: Bong[] = bongsRes.ok ? await bongsRes.json() : []
  const users: User[] = usersRes.ok ? await usersRes.json() : []

  return { bongs, users }
}

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/auth/signin")

  const { bongs, users } = await getData()

  return (
    <div className="flex flex-col h-dvh">
      <AppHeader />
      <div className="flex-1 overflow-hidden flex flex-col max-w-2xl w-full mx-auto px-4">
        <Tabs defaultValue="feed" className="flex-1 overflow-hidden pt-4">
          <TabsList variant="line" className="w-full justify-center">
            <TabsTrigger value="feed">bong feed</TabsTrigger>
            <TabsTrigger value="leaderboard">bong leaderboard</TabsTrigger>
            <TabsTrigger value="bong-of">bong of the...</TabsTrigger>
          </TabsList>
          <TabsContent value="feed" className="overflow-y-auto mt-4 pr-2">
            <BongFeed initial={bongs} userId={session.user.userId} users={users} />
          </TabsContent>
          <TabsContent value="leaderboard" className="overflow-y-auto mt-4">
            <BongLeaderboard />
          </TabsContent>
          <TabsContent value="bong-of" className="overflow-y-auto mt-4">
            <BongOfPeriod userId={session.user.userId} users={users} />
          </TabsContent>
        </Tabs>
      </div>
      <SubmitBar users={users} />
    </div>
  )
}
