# EC2 GitHub Actions Deployment

This repo includes an SSH-based GitHub Actions deployment for a single EC2 host.

## Workflow

Workflow file:

```text
.github/workflows/deploy-ec2.yml
```

It runs on:

- manual `workflow_dispatch`
- pushes to `main`

The workflow:

1. builds `blessing-tree-ui`
2. validates backend runtime dependencies install
3. packages backend source, migrations, requirements, version file, built frontend assets, and the EC2 release script
4. uploads the release tarball to EC2 over SSH
5. activates the release under `/opt/blessing-tree`
6. restarts systemd services for API, Celery worker, and Celery beat

## Required GitHub Secrets

Set these in GitHub repository or environment secrets:

| Secret | Purpose |
| --- | --- |
| `EC2_HOST` | EC2 public DNS name or IP |
| `EC2_USER` | SSH user, for example `ubuntu` or `ec2-user` |
| `EC2_SSH_KEY` | Private SSH key with access to the EC2 host |
| `VITE_API_BASE_URL` | Public API base URL used when building the frontend |

## Optional GitHub Variables

| Variable | Default |
| --- | --- |
| `EC2_PORT` | `22` |
| `EC2_DEPLOY_PATH` | `/opt/blessing-tree` |
| `EC2_API_SERVICE` | `blessing-tree-api` |
| `EC2_CELERY_SERVICE` | `blessing-tree-celery` |
| `EC2_CELERY_BEAT_SERVICE` | `blessing-tree-celerybeat` |
| `BT_KEEP_RELEASES` | `5` |
| `BT_RUN_MIGRATIONS` | `false` |
| `BT_MIGRATION_COMMAND` | empty |

Migrations are not enabled by default because the repo currently stores raw SQL files but does not include a migration runner. If you add Flyway, Alembic, or a small internal runner later, set `BT_RUN_MIGRATIONS=true` and put the command in `BT_MIGRATION_COMMAND`.

## One-Time EC2 Setup

Create the runtime user and deployment folders:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin blessingtree
sudo mkdir -p /opt/blessing-tree/shared /opt/blessing-tree/releases
sudo chown -R blessingtree:blessingtree /opt/blessing-tree
```

Install runtime packages. Package names vary by AMI, but the host needs:

- Python 3.12 or compatible Python 3
- `python3-venv`
- Nginx
- systemd
- access to MySQL
- access to Valkey/Redis

Create the backend environment file:

```bash
sudo cp blessing-tree-api/.env.example /opt/blessing-tree/shared/api.env
sudo chown blessingtree:blessingtree /opt/blessing-tree/shared/api.env
sudo chmod 600 /opt/blessing-tree/shared/api.env
```

Edit `/opt/blessing-tree/shared/api.env` for production values:

- database connection
- JWT/refresh-cookie secrets
- `FRONTEND_BASE_URL`
- Valkey connection
- SMTP settings
- `CURRENT_ENVIRONMENT=production`
- secure cookie flags when HTTPS is enabled

Install systemd service templates:

```bash
sudo cp deploy/ec2/systemd/blessing-tree-api.service /etc/systemd/system/
sudo cp deploy/ec2/systemd/blessing-tree-celery.service /etc/systemd/system/
sudo cp deploy/ec2/systemd/blessing-tree-celerybeat.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable blessing-tree-api blessing-tree-celery blessing-tree-celerybeat
```

Install the Nginx template:

```bash
sudo cp deploy/ec2/nginx/blessing-tree.conf /etc/nginx/conf.d/blessing-tree.conf
sudo nginx -t
sudo systemctl reload nginx
```

The service templates assume releases activate at:

```text
/opt/blessing-tree/current
```

## SSH/Sudo Requirements

The GitHub Actions SSH user needs to:

- write to `/tmp/blessing-tree-deploy`
- run the deployment script
- restart the three systemd services, usually through passwordless sudo

For a locked-down setup, allow only the exact systemctl commands required by the deploy script.

## Deployment Output

Each deployment creates:

```text
/opt/blessing-tree/releases/<timestamp>-blessing-tree-<sha>
/opt/blessing-tree/current -> latest release
```

Old releases are pruned according to `BT_KEEP_RELEASES`.
