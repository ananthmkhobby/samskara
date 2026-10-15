# Environments

Two fully separate stacks — separate Vercel projects, separate Supabase
projects, separate domains. Nothing shared between them except the GitHub
repo itself. This is deliberate: a mistake made while testing must never be
able to touch real family data (see `docs/SDLC.md` for why this was decided
over a single shared backend).

| | Test | Production |
|---|---|---|
| Domain | `samskara-koaham.vercel.app` | `oursamskara.com` |
| Git branch | `dev` | `main` |
| Vercel project | existing project, existing `techlearners` team | new project, same team |
| Supabase project | existing project | new project, upgraded to Pro |
| Purpose | Everything lands and gets verified here first | Only reached via a reviewed release PR |
| Data | Disposable — safe to seed, break, and reset | Real family archives — treat every write as permanent |

## Secrets

Every environment variable in `vercel.json`'s referenced API functions
(`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_ANON_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
`OPENAI_API_KEY`, `ADMIN_PROVISION_SECRET`, `APP_URL`,
`SCANJUNCTION_ALLOWED_ORIGIN`) is configured **per Vercel project**, never
shared. The production project's Supabase keys point at the production
Supabase project; the test project's point at the test one. Rotating a key
in one environment never touches the other.

None of these are ever committed — confirmed: no `.env*` file is tracked in
this repo (`git ls-files | grep env` returns nothing). Local development
reads `.env.local`, which is git-ignored.

## What's identical between them

Schema. Both projects are built from the same ordered set of migrations in
`supabase/migrations/` — replaying them against a fresh project is how the
production Supabase project gets created in the first place, and it's how
the two stay structurally identical even though their data diverges
completely. See `docs/GIT_WORKFLOW.md` for when schema changes go out.

## What's deliberately different

- **Supabase plan**: test can stay on Free; production is Pro (daily
  backups, more compute) — see `docs/BACKUPS.md` for why Pro alone still
  isn't sufficient on its own.
- **Data lifecycle**: test data is disposable by design; production data
  needs the real backup discipline `docs/BACKUPS.md` already describes, now
  pointed at the production project's keys specifically.
