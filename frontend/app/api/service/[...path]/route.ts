import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000"

async function proxy(req: NextRequest, pathSegments: string[]) {
  const pathStr = pathSegments.join("/")
  const url = new URL(`${BACKEND}/service/${pathStr}`)
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))

  const headers: HeadersInit = {}
  const contentType = req.headers.get("content-type")
  if (contentType) headers["Content-Type"] = contentType

  const init: RequestInit = { method: req.method, headers }
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text()
  }

  const res = await fetch(url.toString(), init)

  if (res.headers.get("content-type")?.includes("text/event-stream")) {
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    })
  }

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path)
}
