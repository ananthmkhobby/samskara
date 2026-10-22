#!/usr/bin/env bash
# Fails if supabase/migrations/ has any migration not yet applied to the
# given project. Vercel deploys app code automatically on every push, but
# Supabase migrations are a separate step — nothing enforced that they
# actually happened. Found the hard way (2026-10-21): two migrations an
# already-deployed release depended on (a new table, a widened CHECK
# constraint) had only ever been pushed to the test project, never
# production — production silently ran on stale schema, breaking the
# feature its own deployed code shipped, with no error until a real user
# hit it. This check exists so that gap surfaces in CI, not from a user
# report.
#
# Uses `supabase db query --linked` (the Management API path), not
# `db push`/`migration list` — those need a direct Postgres password this
# script never has access to; the API path only needs SUPABASE_ACCESS_TOKEN.
#
# Usage: SUPABASE_ACCESS_TOKEN=... ./scripts/check-migrations-synced.sh <project-ref>
set -euo pipefail

PROJECT_REF="${1:?Usage: $0 <project-ref>}"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  # Skip rather than fail: this check is new, and failing every push/PR
  # before the secret is even added would just block unrelated work. Once
  # SUPABASE_ACCESS_TOKEN is added as a repo secret (see docs/ENVIRONMENTS.md),
  # this becomes a real enforced gate instead of a loud no-op.
  echo "::warning::SUPABASE_ACCESS_TOKEN is not set — migration sync check skipped, not enforced. See docs/ENVIRONMENTS.md."
  exit 0
fi

supabase link --project-ref "$PROJECT_REF" >/dev/null

LOCAL_VERSIONS=$(ls supabase/migrations/*.sql | xargs -n1 basename | sed 's/_.*//' | sort)
REMOTE_JSON=$(supabase db query --linked "select version from supabase_migrations.schema_migrations order by version asc")
REMOTE_VERSIONS=$(echo "$REMOTE_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(r['version'] for r in d['rows']))" | sort)

MISSING=$(comm -23 <(echo "$LOCAL_VERSIONS") <(echo "$REMOTE_VERSIONS"))

if [ -n "$MISSING" ]; then
  echo "❌ Migrations present locally but NOT applied to project $PROJECT_REF:"
  echo "$MISSING" | sed 's/^/  - /'
  echo ""
  echo "Apply them (supabase db push --linked needs SUPABASE_DB_PASSWORD, or"
  echo "pipe the .sql file through 'supabase db query --linked' as a fallback"
  echo "the way this gap was fixed the first time), then re-run this check."
  exit 1
fi

echo "✅ Project $PROJECT_REF has every local migration applied."
