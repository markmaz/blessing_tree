# Production Backup And Restore Runbook

This runbook covers the current EC2 Docker Compose production stack with RDS
MySQL, bundled Valkey, bundled Qdrant, and Caddy.

## What Is Durable

- RDS MySQL is the source of truth for campaigns, users, sponsors, recipients,
  gifts, communications, audit logs, and Ask logs.
- Qdrant is a rebuildable search index. Back it up when convenient, but restore
  MySQL first and regenerate indexes if Qdrant is missing or stale.
- Valkey is operational queue/cache state. It does not replace MySQL backups.
- Caddy certificates live in the `caddy-data` Docker volume. Do not delete that
  volume during normal deploys.

## Required Production Settings

RDS production instances should have:

- automated backups enabled
- deletion protection enabled
- backup retention long enough to cover at least one campaign operating week
- security group access limited to the Blessing Tree EC2 security group

The EC2 runtime environment is stored at:

```bash
/opt/blessing-tree/shared/blessing-tree.env
```

Keep this file mode `600`; it contains database, mail, OpenAI, and Qdrant
secrets.

## Manual Logical Backup

Use this before risky operations such as migrations, production seed changes,
or campaign deletion.

Run on the EC2 host:

```bash
set -euo pipefail
set -a
. /opt/blessing-tree/shared/blessing-tree.env
set +a

BACKUP_DIR=/opt/blessing-tree/backups/mysql
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/blessing-tree-${CURRENT_ENVIRONMENT:-production}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

docker run --rm \
  -e MYSQL_PWD="$DB_PASSWORD" \
  mysql:8 \
  mysqldump \
    --host="$DB_HOST" \
    --port="${DB_PORT:-3306}" \
    --user="$DB_USER" \
    --single-transaction \
    --routines \
    --triggers \
    --set-gtid-purged=OFF \
    "$DB_NAME" \
  | gzip > "$BACKUP_FILE"

ls -lh "$BACKUP_FILE"
```

Copy the backup off the EC2 host after creation. Keep at least one copy outside
the instance.

## Pre-Migration Snapshot

Before applying production schema changes:

1. Confirm GitHub deploy is not currently running.
2. Create an RDS manual snapshot in AWS.
3. Create a manual logical backup using the command above.
4. Record the current app image tags:

```bash
cd /opt/blessing-tree/compose
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml images
```

## Restore From RDS Snapshot

Preferred for full production recovery:

1. Restore the selected RDS snapshot to a new RDS instance.
2. Point the restored instance security group at the Blessing Tree EC2 security
   group.
3. Update `/opt/blessing-tree/shared/blessing-tree.env`:

```text
DB_HOST=<restored-rds-endpoint>
DB_NAME=<restored-db-name>
DB_USER=<restored-user>
DB_PASSWORD=<restored-password>
```

4. Restart the app stack:

```bash
cd /opt/blessing-tree/compose
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

5. Verify Admin Health, login, campaign list, gift search, sponsor directory,
   and mobile receive.
6. Regenerate Qdrant indexes from Admin Health if semantic gift search or Ask
   knowledge is stale.

## Restore From Logical Backup

Use this when restoring into an empty database or a temporary validation
database.

```bash
set -euo pipefail
set -a
. /opt/blessing-tree/shared/blessing-tree.env
set +a

BACKUP_FILE=/opt/blessing-tree/backups/mysql/<backup-file>.sql.gz

gunzip -c "$BACKUP_FILE" | docker run --rm -i \
  -e MYSQL_PWD="$DB_PASSWORD" \
  mysql:8 \
  mysql \
    --host="$DB_HOST" \
    --port="${DB_PORT:-3306}" \
    --user="$DB_USER" \
    "$DB_NAME"
```

After restore, restart the app stack and regenerate Qdrant indexes if needed.

## Demo Seed Safety

Production demo seeding must be append-only by default:

```bash
cd /opt/blessing-tree/compose
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  python scripts/seed_demo_campaign_2026.py \
    --append \
    --campaign-name "Blessing Tree Walkthrough Demo 2026" \
    --campaign-slug "blessing-tree-walkthrough-demo-2026"
```

The seed script refuses `--reset` when `CURRENT_ENVIRONMENT=production`.
It also refuses production replace/refresh unless
`--allow-production-replace` is passed intentionally. Do not use that override
without a fresh RDS snapshot and logical backup.

## Campaign Delete Safety

Campaign deletion is app-admin only and requires exact typed confirmation of
the campaign name. Before deleting a production campaign:

1. Create an RDS manual snapshot.
2. Create a manual logical backup.
3. Confirm the campaign name and year in the UI.
4. Confirm the deletion target is not the active operating campaign.
5. Type the exact campaign name in the confirmation modal.

## Health Checks After Restore Or Deploy

Use Admin Health to verify:

- database connectivity
- Valkey/Celery queue health
- Qdrant reachability
- embedding provider access
- email provider configuration
- disk/storage pressure

If one dependency fails, treat the dependency-specific error as the first
triage target before debugging application workflows.

Admin Health is intentionally non-destructive. The email check verifies SMTP
configuration is present, but it does not send an email. Use Campaign Studio's
test email flow when delivery needs to be verified end to end.
