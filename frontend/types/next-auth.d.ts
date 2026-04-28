import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      userId?: string
      displayName?: string
      googleId: string
      email?: string | null
      name?: string | null
      image?: string | null
    }
    needsSetup: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string
    displayName?: string
    googleId?: string
    needsSetup?: boolean
  }
}
