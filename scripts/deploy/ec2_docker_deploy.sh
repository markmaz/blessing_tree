#!/usr/bin/env bash
set -Eeuo pipefail

deploy_dir="${BT_APP_DIR:-/opt/blessing-tree}"
compose_dir="$deploy_dir/compose"
shared_dir="$deploy_dir/shared"
release_id="${BT_RELEASE_ID:-manual-$(date -u +%Y%m%d%H%M%S)}"
env_file="${BT_ENV_FILE:-$shared_dir/blessing-tree.env}"

if [ -z "${BT_API_IMAGE:-}" ]; then
  echo "BT_API_IMAGE is required." >&2
  exit 2
fi
if [ -z "${BT_UI_IMAGE:-}" ]; then
  echo "BT_UI_IMAGE is required." >&2
  exit 2
fi

if [ "$(id -u)" -eq 0 ]; then
  sudo_cmd=()
else
  sudo_cmd=(sudo)
fi

"${sudo_cmd[@]}" mkdir -p "$compose_dir/deploy/docker/caddy" "$shared_dir"
"${sudo_cmd[@]}" chown -R "$(id -u):$(id -g)" "$deploy_dir"

if [ ! -f "$env_file" ]; then
  echo "Runtime env file not found: $env_file" >&2
  echo "Create it from deploy/docker/blessing-tree.env.example before deploying." >&2
  exit 1
fi

ln -sfn "$env_file" "$compose_dir/deploy/docker/blessing-tree.env"
ln -sfn "$env_file" "$compose_dir/.env"

if [ -n "${GHCR_USERNAME:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

cd "$compose_dir"

export BT_API_IMAGE
export BT_UI_IMAGE
export BT_ENV_FILE="$env_file"
export BT_IMAGE_TAG="${BT_IMAGE_TAG:-$release_id}"
export BT_HTTP_PORT="${BT_HTTP_PORT:-80}"
export BT_HTTPS_PORT="${BT_HTTPS_PORT:-443}"

docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans

docker image prune -f >/dev/null 2>&1 || true

echo "Deployed Blessing Tree Docker release: $release_id"
