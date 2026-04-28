# bong-registry

Social app where users catch bongs on friends for doing dumb things. LLM judges submissions via claude-sonnet-4-6.

## Stack

- **Backend**: FastAPI + SQLAlchemy async + Alembic + asyncpg + Anthropic SDK, Python 3.13
- **Frontend**: Next.js 16 (App Router), Node 24, TypeScript, Tailwind, shadcn/ui, next-auth v4
- **DB**: PostgreSQL (local dev via Unix socket at `/tmp`)
- **Auth**: Google OAuth via next-auth v4 — `google_id` is the identity anchor, `display_name` is what everyone sees
- **Infra**: k3s on Hetzner, Nginx ingress, cert-manager, domain: catchbong.com

## Dev environment

Uses Nix flakes + uv2nix. Commands are on PATH directly in the dev shell — **never use `uv run`**.

Enter the shell: `nix develop` (default shell has everything)

## Key commands (justfile)

```
just db-init        # first-time postgres setup
just db-start       # start postgres
just db-stop        # stop postgres
just db-reset       # nuke and recreate db + run migrations
just migrate        # run alembic migrations
just migration <name>  # create a new migration
just dev            # start postgres + backend + frontend together
just dev-backend    # backend only
just dev-frontend   # frontend only
just cluster-bootstrap  # k8s first-time setup (requires POSTGRES_PASSWORD env)
just k8s-apply      # apply all k8s manifests
just k8s-status     # pod/svc/ingress/pvc status
```

## Key files

- `flake.nix` — dev shells + uv2nix workspace
- `justfile` — all dev and infra commands
- `backend/app/main.py` — FastAPI app, all routes under `/service` prefix
- `backend/app/models.py` — User, Bong, BongSubject, Cosign
- `backend/app/llm.py` — Anthropic judge, returns score/tier/verdict
- `backend/app/routes/` — bongs, leaderboard, users, stream (SSE)
- `backend/alembic/` — migrations (async, reads DATABASE_URL env var)
- `frontend/auth.ts` — NextAuth config (Google provider, JWT + session callbacks)
- `frontend/proxy.ts` — route protection (unauthenticated → sign in, needsSetup → /setup)
- `frontend/app/` — Next.js pages
- `frontend/types/next-auth.d.ts` — Session/JWT type augmentation
- `k8s/` — manifests for postgres, backend, frontend, ingress, cert-manager

## DB (local dev)

- Socket dir: `/tmp` (set via `unix_socket_directories` in postgresql.conf)
- URL: `postgresql+asyncpg://localhost/bong?host=/tmp`
- Data dir: `backend/.pgdata`

## Frontend env vars

See `frontend/.env.local.example`. Required: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL`.

**Never read `frontend/.env.local` — it contains real secrets.**

The Next.js dev server proxies `/service/*` → backend via rewrites in `next.config.ts`. In production, nginx ingress handles this routing.

## Architecture notes

- SSE live feed: module-level `_listeners` list in `routes/stream.py`, `broadcast()` called after each bong submission
- Ingress routes: `/service/*` → FastAPI (port 8000), `/*` → Next.js (port 3000)
- Postgres 18 in k8s: mount at `/var/lib/postgresql` (not `/data`)
- k3s flannel must use private interface: `--flannel-iface enp7s0` on Hetzner
- Catppuccin Mocha theme, dark mode only — all CSS vars in `:root`, no `.dark` block
