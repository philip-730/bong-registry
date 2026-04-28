import NextAuth, { type AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000"

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, account, trigger, session }) {
      if (account) {
        // First sign-in — look up user in DB
        token.googleId = account.providerAccountId
        try {
          const res = await fetch(
            `${BACKEND_URL}/service/users?google_id=${account.providerAccountId}`
          )
          const users = await res.json()
          if (users.length > 0) {
            token.userId = users[0].id
            token.displayName = users[0].display_name
            token.needsSetup = false
          } else {
            token.needsSetup = true
          }
        } catch {
          token.needsSetup = true
        }
      }
      // After setup completion: client calls update({ userId, displayName })
      if (trigger === "update" && session?.userId) {
        token.userId = session.userId
        token.displayName = session.displayName
        token.needsSetup = false
      }
      return token
    },
    async session({ session, token }) {
      session.user.googleId = token.googleId as string
      session.user.userId = token.userId as string | undefined
      session.user.displayName = token.displayName as string | undefined
      session.needsSetup = (token.needsSetup as boolean) ?? false
      return session
    },
  },
}

export default NextAuth(authOptions)
