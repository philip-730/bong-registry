# Catch Bong

In our local culture, "bong" is what we say when you do something stupid. To *catch a bong on someone* means to call them out for it. This app is an overengineered, self-hosted realization of that cultural process.

A social app where you catch bongs on your friends for doing dumb things. Claude judges every submission and rates it on a scale from *not that bong* to *bong bong bong*.

Live at [catchbong.com](https://catchbong.com).

---

## What it does

You type what your friend did. You @mention them. You hit bong.

Claude reads the offense, writes a blunt one-liner verdict, and assigns a score from 1.0–10.0 with a tier. The verdict streams character by character into the feed in real time. Everyone with the app open sees it land.

Friends can co-sign with a +bong button. Leaderboards track total bong score by week, month, year, and all time.

### The scale

| Score | Tier |
|---|---|
| 1.0 – 1.9 | not that bong |
| 2.0 – 2.9 | kinda bong |
| 3.0 – 3.9 | mini bong |
| 4.0 – 4.9 | semi bong |
| 5.0 – 5.9 | half bong |
| 6.0 – 6.9 | three quarters bong |
| 7.0 – 7.9 | mega bong |
| 8.0 – 8.9 | od bong |
| 9.0 – 9.9 | oddd bong |
| 10.0 | bong bong bong |

---

## Features

- **@mention autocomplete** — tag one or multiple people in the offense, names stored as structured tokens so display names stay correct if someone renames
- **Real-time feed** — SSE stream pushes new bongs and verdict chunks to all connected clients without polling
- **Streaming verdicts** — Claude's response streams char by char; score and tier appear when judging completes
- **Co-signs** — one +bong per user per bong, togglable, shown on the card
- **Leaderboards** — ranked by total bong score, filterable by period, sortable by co-sign count
- **Bong of the period** — highest single-score bong for the week/month/year, shown on the leaderboard page
- **Feed filters** — filter by caught by or caught on a specific user
- **Google OAuth** — closed group, friends added as test users in Google Cloud console (no app verification needed, free up to 100 users)

---

## Stack

**Backend** — FastAPI, SQLAlchemy (async), Alembic, asyncpg, Anthropic SDK (claude-sonnet-4-6), Python 3.13

**Frontend** — Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, next-auth v4, Catppuccin Mocha

**Database** — PostgreSQL 18

**Infrastructure** — self-managed k3s cluster on Hetzner, 3 nodes (1 control plane, 2 workers), Nginx ingress, cert-manager + Let's Encrypt, ghcr.io for images

**Dev tooling** — Nix flakes, uv2nix for Python, buildNpmPackage for Next.js standalone, dockerTools.streamLayeredImage for OCI builds (no Docker), skopeo for pushing, justfile for everything

---

## Architecture

```
catchbong.com
    │
    ▼
Nginx ingress (worker-1, public IP)
    ├── /*         → Next.js  (port 3000)
    └── /service/* → FastAPI  (port 8000)
                        │
                    BackgroundTask
                        │
                    Anthropic API
                        │
                    SSE broadcast → all clients
```

OCI images are built with Nix and pushed to ghcr.io via GitHub Actions on every push to main. The backend deployment runs `alembic upgrade head` as an init container before the pod starts — migrations are fully automated on deploy.

Postgres runs as a StatefulSet on worker-2 with a persistent volume. It never touches the public internet.

---

## Dev setup

```bash
nix develop    # drops into shell with everything on PATH
just db-init   # first-time postgres setup
just dev       # starts postgres + backend + frontend
```

See `spec.md` for the full details on the stack and feature spec.
