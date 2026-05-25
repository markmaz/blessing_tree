#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: ec2_deploy_release.sh <release-archive.tar.gz> [deploy-dir]" >&2
  exit 2
fi

archive_path="$1"
deploy_dir="${2:-${BT_APP_DIR:-/opt/blessing-tree}}"
release_id="$(date -u +%Y%m%d%H%M%S)-$(basename "$archive_path" .tar.gz)"
release_dir="$deploy_dir/releases/$release_id"
shared_dir="$deploy_dir/shared"
current_link="$deploy_dir/current"
keep_releases="${BT_KEEP_RELEASES:-5}"

api_service="${BT_API_SERVICE:-blessing-tree-api}"
celery_service="${BT_CELERY_SERVICE:-blessing-tree-celery}"
celery_beat_service="${BT_CELERY_BEAT_SERVICE:-blessing-tree-celerybeat}"
run_migrations="${BT_RUN_MIGRATIONS:-false}"
migration_command="${BT_MIGRATION_COMMAND:-}"

if [ "$(id -u)" -eq 0 ]; then
  sudo_cmd=()
else
  sudo_cmd=(sudo)
fi

if [ ! -f "$archive_path" ]; then
  echo "Release archive not found: $archive_path" >&2
  exit 1
fi

"${sudo_cmd[@]}" mkdir -p "$deploy_dir/releases" "$shared_dir"
"${sudo_cmd[@]}" chown -R "$(id -u):$(id -g)" "$deploy_dir"

mkdir -p "$release_dir"
tar -xzf "$archive_path" -C "$release_dir"

if [ -f "$shared_dir/api.env" ]; then
  ln -sfn "$shared_dir/api.env" "$release_dir/blessing-tree-api/.env"
fi

python3 -m venv "$release_dir/blessing-tree-api/.venv"
"$release_dir/blessing-tree-api/.venv/bin/python" -m pip install --upgrade pip
"$release_dir/blessing-tree-api/.venv/bin/python" -m pip install \
  -r "$release_dir/blessing-tree-api/requirements.txt"

if [ "$run_migrations" = "true" ]; then
  if [ -z "$migration_command" ]; then
    echo "BT_RUN_MIGRATIONS=true but BT_MIGRATION_COMMAND is empty." >&2
    echo "Skipping migrations because this repo does not yet include a migration runner." >&2
  else
    (
      cd "$release_dir/blessing-tree-api"
      eval "$migration_command"
    )
  fi
fi

ln -sfn "$release_dir" "$current_link"

restart_service() {
  local service_name="$1"
  if [ -z "$service_name" ]; then
    return
  fi
  "${sudo_cmd[@]}" systemctl restart "$service_name"
  "${sudo_cmd[@]}" systemctl is-active --quiet "$service_name"
}

restart_service "$api_service"
restart_service "$celery_service"
restart_service "$celery_beat_service"

if command -v systemctl >/dev/null 2>&1; then
  "${sudo_cmd[@]}" systemctl reload nginx >/dev/null 2>&1 || true
fi

find "$deploy_dir/releases" -mindepth 1 -maxdepth 1 -type d \
  | sort -r \
  | tail -n +"$((keep_releases + 1))" \
  | xargs -r rm -rf

echo "Deployed Blessing Tree release: $release_id"
