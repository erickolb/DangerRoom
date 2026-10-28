#!/usr/bin/env bash
set -euo pipefail

# Compose finds .env and any configured override relative to the checkout.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

dangerroom_url=$(sudo docker compose exec -T dangerroom node -p 'process.env.DANGERROOM_URL || ""')
if [[ -z "$dangerroom_url" ]]; then
  echo 'Set DANGERROOM_URL in .env, recreate the container, then retry the health check.' >&2
  exit 1
fi

curl --fail "${dangerroom_url%/}/api/health"
