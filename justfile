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

k8s-apply:
    kubectl apply -f k8s/

k8s-delete:
    kubectl delete -f k8s/

k8s-status:
    kubectl get pods,svc,ingress,pvc
