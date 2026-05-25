# EC2 Docker Compose Deployment

This is the preferred deployment shape for Blessing Tree:

```text
Internet
  |
EC2: Docker Compose
  |-- caddy: public HTTP/HTTPS entrypoint with automatic TLS
  |-- frontend: Nginx serving the React build and proxying /api
  |-- api: Flask/Gunicorn
  |-- celery-worker
  |-- celery-beat
  |-- valkey
  |
RDS MySQL
```

RDS should own the database. The EC2 host should be disposable enough that a new host can pull the same images and run the same Compose stack.

## Files

```text
Dockerfile locations:
  blessing-tree-api/Dockerfile
  blessing-tree-ui/Dockerfile

Compose:
  docker-compose.yml
  docker-compose.prod.yml

Runtime env template:
  deploy/docker/blessing-tree.env.example

Frontend Nginx config:
  deploy/docker/nginx/blessing-tree-ui.conf

Caddy config:
  deploy/docker/caddy/Caddyfile

GitHub Actions:
  .github/workflows/deploy-docker-ec2.yml

Remote deployment script:
  scripts/deploy/ec2_docker_deploy.sh
```

## Container Roles

- `caddy`: public HTTP/HTTPS entrypoint. Terminates TLS and proxies to `frontend:80`.
- `frontend`: internal Nginx container. Serves static React assets and proxies `/api` to `api:5000`.
- `api`: Gunicorn running `app.main:blessing_tree`.
- `celery-worker`: Celery worker on queue `bt`.
- `celery-beat`: Celery beat scheduler.
- `valkey`: local Valkey for Celery broker/result backend and audit queue.

## RDS

Recommended RDS setup:

- MySQL-compatible engine
- private subnet if possible
- security group allowing inbound MySQL only from the EC2 security group
- automated backups enabled
- deletion protection enabled for production

The app receives RDS settings through:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

## One-Time EC2 Setup

Install Docker and the Compose plugin on the EC2 host.

Create deploy folders:

```bash
sudo mkdir -p /opt/blessing-tree/shared /opt/blessing-tree/compose
sudo chown -R "$USER":"$USER" /opt/blessing-tree
```

Create the runtime env file:

```bash
cp deploy/docker/blessing-tree.env.example /opt/blessing-tree/shared/blessing-tree.env
chmod 600 /opt/blessing-tree/shared/blessing-tree.env
```

Edit `/opt/blessing-tree/shared/blessing-tree.env` with production values.

Important production values:

- `CURRENT_ENVIRONMENT=production`
- `BT_SITE_ADDRESS=<your-domain>` for HTTPS, for example `blessingtree.example.org`
- `DB_HOST=<rds endpoint>`
- `FRONTEND_BASE_URL=https://your-domain`
- `INVITE_URL=https://your-domain/auth/register`
- `PASSWORD_RESET_URL=https://your-domain/auth/reset`
- `GOOGLE_REDIRECT_URI=https://your-domain/api/v1/auth/google/callback`
- `YAHOO_REDIRECT_URI=https://your-domain/api/v1/auth/yahoo/callback`
- `REFRESH_COOKIE_SECURE=true`
- `COOKIE_SECURE=true`
- `VALKEY_ADDRESS=valkey`

## GitHub Secrets

Required:

| Secret | Purpose |
| --- | --- |
| `EC2_HOST` | EC2 public DNS name or IP |
| `EC2_USER` | SSH user |
| `EC2_SSH_KEY` | Private SSH key for EC2 deploy |

Required if GHCR images are private:

| Secret | Purpose |
| --- | --- |
| `GHCR_USERNAME` | GitHub username or bot account |
| `GHCR_TOKEN` | PAT with `read:packages` for pulling images on EC2 |

Optional:

| Secret or variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Leave empty for same-origin `/api`; set only when API is on another origin |

## GitHub Variables

Optional:

| Variable | Default |
| --- | --- |
| `EC2_PORT` | `22` |
| `EC2_DEPLOY_PATH` | `/opt/blessing-tree` |
| `BT_HTTP_PORT` | `80` |
| `BT_HTTPS_PORT` | `443` |

## Deploy

The workflow runs on:

- manual `workflow_dispatch`
- pushes to `main`

It builds and pushes:

```text
ghcr.io/<owner>/blessing-tree-api:<commit-sha>
ghcr.io/<owner>/blessing-tree-ui:<commit-sha>
```

Then it uploads the Compose files to EC2 and runs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

## Manual Local Build

From the repo root:

```bash
cp deploy/docker/blessing-tree.env.example deploy/docker/blessing-tree.env
docker compose build
docker compose up -d
```

For local-only testing, leave `BT_SITE_ADDRESS=:80` and edit `deploy/docker/blessing-tree.env` for your database. For production, use RDS and set `BT_SITE_ADDRESS` to the public domain so Caddy can issue and renew Let's Encrypt certificates.

## Migrations

The repo currently has raw SQL migration files under:

```text
blessing-tree-api/db/migration
```

There is not yet a Dockerized migration runner. Until one is added, apply migrations to RDS through the same SQL process used during development verification.

Recommended next improvement: add a tiny migration runner container or Flyway container so deployment can run migrations before `api` restarts.

## TLS

Caddy is included in the Compose stack and is the only public web entrypoint.

For local HTTP-only testing:

```text
BT_SITE_ADDRESS=:80
```

For production HTTPS:

```text
BT_SITE_ADDRESS=blessingtree.example.org
BT_HTTP_PORT=80
BT_HTTPS_PORT=443
```

DNS must point the domain to the EC2 instance, preferably through an Elastic IP. The EC2 security group must allow inbound `80` and `443`. Port `80` is still required because Let's Encrypt uses it for HTTP validation and Caddy redirects HTTP traffic to HTTPS after certificates are issued.

Caddy certificate state is stored in the `caddy-data` Docker volume. Do not delete that volume during normal deployments.
