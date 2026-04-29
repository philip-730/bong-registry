set dotenv-load := true

default:
    @just --list

pg_data := "backend/.pgdata"
db_name := "bong"
db_url  := "postgresql+asyncpg://localhost/" + db_name + "?host=/tmp"

# ------------------------------------------------------------------ #
# Postgres
# ------------------------------------------------------------------ #

db-start:
    #!/usr/bin/env bash
    if pg_ctl -D {{pg_data}} status > /dev/null 2>&1; then
        echo "postgres already running"
    else
        pg_ctl -D {{pg_data}} -l {{pg_data}}/logfile start -w
    fi

db-stop:
    pg_ctl -D {{pg_data}} -m fast stop

db-init:
    #!/usr/bin/env bash
    if [ -d "{{pg_data}}" ]; then
        echo "{{pg_data}} already exists, skipping initdb"
    else
        initdb -D {{pg_data}}
        echo "unix_socket_directories = '/tmp'" >> {{pg_data}}/postgresql.conf
    fi
    just db-start
    createdb -h /tmp {{db_name}} || true

db-reset:
    #!/usr/bin/env bash
    just db-stop || true
    rm -rf {{pg_data}}
    just db-init
    DATABASE_URL={{db_url}} just migrate

# ------------------------------------------------------------------ #
# Migrations
# ------------------------------------------------------------------ #

migrate:
    cd backend && DATABASE_URL={{db_url}} alembic upgrade head

test-db-init:
    createdb -h /tmp bong_test

test:
    cd backend && DATABASE_URL=postgresql+asyncpg://localhost/bong_test?host=/tmp alembic upgrade head && python -m pytest tests/ -v

migration name:
    cd backend && DATABASE_URL={{db_url}} alembic revision --autogenerate -m "{{name}}"

# ------------------------------------------------------------------ #
# Dev servers
# ------------------------------------------------------------------ #

dev: db-start
    #!/usr/bin/env bash
    trap 'kill %1 %2 2>/dev/null' EXIT
    DATABASE_URL={{db_url}} uvicorn app.main:app --reload --port 8000 &
    cd frontend && npm run dev &
    wait

dev-backend: db-start
    DATABASE_URL={{db_url}} uvicorn app.main:app --reload --port 8000 --app-dir backend

dev-frontend:
    cd frontend && npm run dev

# ------------------------------------------------------------------ #
# k8s
# ------------------------------------------------------------------ #

cluster-bootstrap:
    #!/usr/bin/env bash
    set -e

    if [ -z "$POSTGRES_PASSWORD" ]; then
        echo "error: POSTGRES_PASSWORD env var is not set"
        exit 1
    fi

    echo "==> adding helm repos"
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add jetstack https://charts.jetstack.io
    helm repo update

    echo "==> installing nginx ingress controller"
    helm install ingress-nginx ingress-nginx/ingress-nginx \
        --set controller.nodeSelector."role"=ingress

    echo "==> installing cert-manager"
    helm install cert-manager jetstack/cert-manager \
        --namespace cert-manager --create-namespace \
        --set crds.enabled=true \
        --timeout 5m

    echo "==> waiting for cert-manager"
    kubectl wait --namespace cert-manager --for=condition=ready pod \
        --selector=app.kubernetes.io/instance=cert-manager --timeout=120s

    echo "==> creating postgres secret"
    kubectl create secret generic postgres-secret \
        --from-literal=password="$POSTGRES_PASSWORD"

    echo "==> deploying"
    just k8s-apply

k8s-apply:
    kubectl apply -f k8s/

k8s-delete:
    kubectl delete -f k8s/

k8s-status:
    kubectl get pods,svc,ingress,pvc

# Print the npmDepsHash needed in flake.nix for the frontend buildNpmPackage.
# Paste the output into the npmDepsHash field in flake.nix.
npm-deps-hash:
    nix run nixpkgs#prefetch-npm-deps -- frontend/package-lock.json

# Create k8s secrets for backend and frontend.
# Requires env vars: POSTGRES_PASSWORD, ANTHROPIC_API_KEY,
#                    NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
k8s-secrets:
    #!/usr/bin/env bash
    set -e

    if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$ANTHROPIC_API_KEY" ] || \
       [ -z "$NEXTAUTH_SECRET" ] || [ -z "$GOOGLE_CLIENT_ID" ] || \
       [ -z "$GOOGLE_CLIENT_SECRET" ]; then
        echo "error: one or more required env vars are not set"
        echo "  required: POSTGRES_PASSWORD, ANTHROPIC_API_KEY, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
        exit 1
    fi

    kubectl create secret generic backend-secret \
        --from-literal=database-url="postgresql+asyncpg://bong:${POSTGRES_PASSWORD}@postgres/bong" \
        --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic frontend-secret \
        --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
        --from-literal=google-client-id="$GOOGLE_CLIENT_ID" \
        --from-literal=google-client-secret="$GOOGLE_CLIENT_SECRET" \
        --dry-run=client -o yaml | kubectl apply -f -

    echo "==> secrets applied"
