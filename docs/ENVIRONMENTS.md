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

## A real gotcha, already hit and fixed (2026-10-15)

`samskara-koaham.vercel.app` was originally set up as a loose `vercel alias
set` pointer, not a domain registered on the project. A registered domain
(like `oursamskara.com`) auto-follows every new Production deployment
forever; a loose alias is a static pointer that does **not** — it silently
keeps serving whatever deployment it was last pointed at, even after the
project's Production Branch changes and a genuinely new Production deploy
goes out. This is exactly what happened when `samskara`'s Production Branch
was switched to `dev`: the branch-tracking setting was correct and new
Production deploys built correctly, but the domain itself kept serving a
two-day-old build until this was caught and fixed.

**Fixed** by registering it as a proper project domain via the API (the
same mechanism the dashboard's "Add Domain" uses), so it now behaves
exactly like `oursamskara.com` — auto-follows Production, no manual
re-aliasing ever needed again. Lesson for next time: after any Vercel
domain/alias setup, confirm via `GET /v9/projects/<id>/domains/<name>`
that `verified: true` comes back — a 404 there means it's just a loose
alias, not a real tracked domain, regardless of how normal it looks in a
browser.

## What's deliberately different

- **Supabase plan**: test can stay on Free; production is Pro (daily
  backups, more compute) — see `docs/BACKUPS.md` for why Pro alone still
  isn't sufficient on its own.
- **Data lifecycle**: test data is disposable by design; production data
  needs the real backup discipline `docs/BACKUPS.md` already describes, now
  pointed at the production project's keys specifically.
