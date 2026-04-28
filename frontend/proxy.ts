import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export async function proxy(req: NextRequest) {
  const token = await getToken({ req })
  const { pathname } = req.nextUrl

  if (!token) {
    if (pathname === "/auth/signin") return NextResponse.next()
    return NextResponse.redirect(new URL("/auth/signin", req.url))
  }

  if (token.needsSetup && pathname !== "/setup") {
    return NextResponse.redirect(new URL("/setup", req.url))
  }

  if (!token.needsSetup && pathname === "/setup") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|service|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)"],
}
