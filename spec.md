# Bong Registry — App Spec

## Concept

A registry for catching bongs. When someone does something dumb, you open the app,
log what they did (catch a bong on them), and the LLM judges whether it's a bong and how bad.
Friends can co-sign with a bong button. Leaderboards track who's catching the most bongs across
all time, year, month, and week.

---

## Bong Scale

The LLM grades every submission on a decimal scale of 1.0–10.0 and returns a tier:

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

## LLM Judging

Every bong submission goes through the LLM before being saved.

The LLM reads the offense, assigns a decimal score, and returns the tier name.
It speaks in bong — no formal language, no courtroom framing. Just blunt verdicts.

Examples:

> "Bong on them. Od bong. 8.4."

> "Not that bong. 1.8."

> "Bong bong bong. 10.0. No further comment."

The system prompt gives the LLM the scale and instructs it to respond only in bong
vernacular. Weak submissions just score low — the scale handles bad faith naturally.

---

## Core Features

### Submit a Bong
- Select subject (existing user or add new name)
- Describe the offense (free text)
- Submit → LLM judges → verdict displayed immediately

### Bong Feed
- Live feed of recent bongs, newest first
- Shows: subject, offense description, tier, score, co-sign count
- Real-time updates via SSE — new bongs appear without refresh for anyone
  who has the app open

### Co-sign (Bong Button)
- Bong button (custom bong branded emoji / svg) on every bong entry
- One co-sign per user per bong
- Co-sign count displayed on the entry

### Leaderboards
- All time, this year, this month, this week
- Ranked by total bong score (sum of all bong scores for that person)
- Shows: rank, name, bong count, total score, highest single bong
- Leaderboard also sortable by co-sign count

### Bong of the Week / Month / Year
- Highest single-score bong in the period
- Displayed prominently on the leaderboard page

---

## Data Model

### users
```
id              uuid primary key
google_id       text not null unique
email           text not null unique
display_name    text not null unique
created_at      timestamptz default now()
```

### bongs
```
id              uuid primary key
submitter_id    uuid references users(id)
offense         text not null
tier            text not null
score           numeric(4,1) not null
llm_response    text not null
created_at      timestamptz default now()
```

### bong_subjects
```
bong_id     uuid references bongs(id)
user_id     uuid references users(id)
primary key (bong_id, user_id)
```

Multiple subjects per bong are supported from day one. Each subject receives the full
bong score on their leaderboard total. UI initially supports one subject, multi-subject
can be added without a schema change.

### cosigns
```
id          uuid primary key
bong_id     uuid references bongs(id)
user_id     uuid references users(id)
created_at  timestamptz default now()
unique(bong_id, user_id)
```

---

## API — FastAPI

### Endpoints

```
GET  /service/users                    list all users
POST /service/users                    create user

POST /service/bongs                    submit a bong (triggers LLM judging)
GET  /service/bongs                    paginated bong feed
GET  /service/bongs/{id}               single bong detail

POST /service/bongs/{id}/cosign        co-sign a bong
DELETE /service/bongs/{id}/cosign      remove co-sign

GET  /service/leaderboard              query params: period (week|month|year|all)
GET  /service/bong-of-the-period       query params: period (week|month|year)

GET  /service/stream                   SSE endpoint — pushes new bong events to clients
```

### LLM Flow (on POST /bongs)
1. Receive subject, submitter, offense
2. Call LLM with system prompt + offense text
3. Parse structured JSON response: `{ score, tier, verdict_text }`
4. Write to `bongs` table
5. Publish event to SSE stream
6. Return verdict to client

### SSE Stream
- `GET /stream` opens a persistent connection
- On new bong insert, server pushes event to all connected clients
- Event payload: full bong object (id, subject, tier, score, verdict text)
- Client reconnects automatically on disconnect

---

## Stack

### Backend
- **FastAPI** — API + SSE stream
- **SQLAlchemy** — ORM
- **Alembic** — migrations
- **asyncpg** — async Postgres driver
- **Anthropic Python SDK** — LLM calls (claude-sonnet-4-6)
- **Python 3.13**

### Frontend
- **Next.js 16** (App Router)
- **Node 24**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** — component library
- **next-auth** — Google OAuth
- Native `EventSource` API for SSE consumption

### Database
- **PostgreSQL 18**
- Persistent volume on k3s

### Infrastructure
- **k3s** — lightweight Kubernetes distribution, self-managed on Hetzner
- **Nginx ingress controller** (Traefik disabled at k3s install)
- **Helm** for Nginx ingress install
- **cert-manager** + Let's Encrypt for TLS
- **Hetzner nodes** — 1x control (CX22), 2x workers (CX22). `worker-1` gets public IP.
- Managed in `capsule-corp` repo
- Node provisioning via cloud-init (not NixOS — cattle machines, no Tailscale needed)

### Networking
- All nodes on Hetzner private network `10.0.1.0/24` (already exists in capsule-corp)
- Nodes talk to each other over private IPs — k3s internal networking handles the rest
- `worker-1` is the ingress node — only node with a public IP, 80/443 open
- `control` and `worker-2` have no public IPs
- `vegeta` reaches control plane API at its private IP over the Hetzner network
- `bong.philipamendolia.com` A record points at `worker-1` public IP

| Machine | Public IP | Open Ports | Role |
|---|---|---|---|
| `vegeta` | Tailscale only | UDP 41641, ICMP | Dev machine, kubectl, already exists |
| `control` | No | — | k3s control plane |
| `worker-1` | Yes | 80, 443 | k3s worker + ingress node |
| `worker-2` | No | — | k3s worker |

### Cluster Access
- `kubectl` and cluster tooling (`helm`, `k9s`) live in the bong registry `flake.nix`
- `nix develop` on vegeta spawns the dev shell with everything needed to control the cluster
- kubeconfig points at `control` private IP — reachable from vegeta over Hetzner private network
- No changes to vegeta's NixOS config in phix

### Nix / Dev Shell
- `flake.nix` modeled after [hen-wen](https://github.com/philip-730/hen-wen/blob/main/flake.nix)
- **uv2nix** for Python backend venv
- **buildNpmPackage** for Next.js standalone build
- **dockerTools.streamLayeredImage** for OCI images (no Docker)
- Dev shell packages: `nodejs_24`, `python313`, `uv`, `just`, `skopeo`, `kubectl`, `helm`, `k9s`
- Three shells: `default` (everything), `frontend`, `backend` , `k8s`

### Ingress Routing
```
/*         → Next.js service (port 3000)
/service/* → FastAPI service (port 8000)
```

`/api/*` is reserved for Next.js API routes. FastAPI uses `/service` prefix to avoid
collision and keep the door open for Next.js server-side routes.

### Nginx Annotations for SSE
```yaml
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

---

## Kubernetes Resources

Three pods total: `frontend`, `backend`, `postgres`.

### frontend + backend
- `Deployment`
- `Service` (ClusterIP)

### Postgres
- `StatefulSet` — stable pod identity, predictable PVC binding
- `Service` (ClusterIP — internal only, never exposed)
- `PersistentVolumeClaim` — local volume on `worker-2`
- Pinned to `worker-2` via `nodeSelector` — keeps PVC collocated with the pod,
  avoids cross-node volume issues on bare metal k3s

### Ingress
- Single `Ingress` resource (Nginx) on `worker-1`
- `worker-1` labeled `role: ingress`, Nginx ingress controller pinned there via `nodeSelector`

### Secrets
- Anthropic API key
- Postgres connection string
- Managed via k8s `Secret` resources, injected as env vars

---

## Repo Structure

```
bong-registry/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── bongs.py
│   │   │   ├── users.py
│   │   │   ├── leaderboard.py
│   │   │   └── stream.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── db.py
│   │   └── llm.py
│   ├── alembic/
│   └── pyproject.toml
├── frontend/
│   ├── app/
│   │   ├── page.tsx          -- feed
│   │   ├── leaderboard/
│   │   │   └── page.tsx
│   │   └── submit/
│   │       └── page.tsx
│   ├── components/
│   └── package.json
├── k8s/
│   ├── backend.yaml
│   ├── frontend.yaml
│   ├── postgres.yaml
│   └── ingress.yaml
└── flake.nix                 -- dev shell + OCI image builds
```

---

## LLM System Prompt (Draft)

```
You are the bong judge. Your job is to grade bong submissions.

A "bong" is when someone does something dumb. "Catching a bong" means you got called
out for it.

You speak only in bong vernacular. No formal language. Be blunt.

Bong scale:
1.0–1.9: not that bong
2.0–2.9: kinda bong
3.0–3.9: mini bong
4.0–4.9: semi bong
5.0–5.9: half bong
6.0–6.9: three quarters bong
7.0–7.9: mega bong
8.0–8.9: od bong
9.0–9.9: oddd bong
10.0: bong bong bong

You must respond only with valid JSON in this exact format:
{
  "score": <decimal 1.0–10.0>,
  "tier": <tier name from scale>,
  "verdict": <one or two sentences max, in bong vernacular>
}
```

---

## Development Plan

### Phase 1 — Local Dev
- Nix dev shell with `nodejs_24`, `python313`, `uv`, `postgresql`, `just`
- Next.js and FastAPI running as local processes
- Postgres running locally via `pg_ctl` — justfile recipes for `db-start`, `db-stop`, `db-reset`
- Alembic migrations, basic routing, Postgres connection all working
- No containers, no k8s — just prove the stack

### Phase 2 — k3s Hello World
- Terraform nodes in capsule-corp — `control`, `worker-1` (public IP), `worker-2`
- cloud-init bootstraps k3s on each node, joins cluster
- Nginx ingress controller via Helm, Traefik disabled
- cert-manager + Let's Encrypt, `bong.philipamendolia.com` resolves with valid TLS
- Deploy placeholder images to validate infrastructure:
  - `nginx` as frontend placeholder — ingress routing works
  - `httpbin` as backend placeholder — `/service/*` routing works
  - `postgres:18` official image — StatefulSet + PVC works, pinned to `worker-2`
- No app code yet — purely infrastructure validation

### Phase 3 — Build the App
- Full feature build: submit, feed, SSE, co-signs, leaderboard, LLM judging
- Running locally against local Postgres
- Infrastructure is solved, iterate fast on features

### Phase 4 — Containerize and Deploy
- OCI images built via `flake.nix` with `dockerTools.streamLayeredImage`
- Pushed to ghcr.io with `skopeo`
- Replace placeholder images in k8s manifests with real images
- `just deploy-backend`, `just deploy-frontend` recipes run from vegeta
- Postgres official image replaced with Nix-built image

- **Auth** — Google OAuth via `next-auth`. Google Cloud project set to "testing" mode,
  friends added as test users manually — supports up to 100, no app verification needed,
  completely free. First time login prompts for a unique display name. Session stored in
  a cookie. `google_id` is the identity anchor, display name is unique and what everyone sees.
- **Co-signs** — count only, no score impact. `cosigns` table is just a count relationship.
- **Bong subjects** — junction table from day one. UI starts with single subject, multi-subject requires no schema change to add later. Each subject gets the full bong score.
- **Future migration** — if Hetzner costs aren't worth it after the lab, migrate to Cloud Run (FastAPI + Next.js) + Supabase (Postgres). Connection string swap, no app code changes needed.
- **Bong of the period** — auto-calculated. Query for max score bong within the time window.
