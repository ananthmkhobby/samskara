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
`TWILIO_NUDGE_TEMPLATE_SID`, `OPENAI_API_KEY`, `CRON_SECRET`,
`APP_URL`, `SCANJUNCTION_ALLOWED_ORIGIN`) is configured **per Vercel
project**, never shared. The production project's Supabase keys point at
the production Supabase project; the test project's point at the test one.
Rotating a key in one environment never touches the other.

`ADMIN_PROVISION_SECRET` is retired (2026-10-29) — every human-operator
superadmin endpoint now authenticates via the caller's own session and a
`superadmins` table instead of a shared secret (see
`docs/ARCHITECTURE_REVIEW.md` §9 action item 8 and
`supabase/migrations/20261029180000_superadmins.sql`). Adding a new
superadmin is a direct SQL insert, no env var involved. `CRON_SECRET`
still gates Vercel Cron's own GET request to `api/broadcast.js` — kept as
a shared secret deliberately, since that's a service-to-service call with
no human operator behind it.

`VITE_WHATSAPP_DISPLAY_NUMBER` is the one WhatsApp-related var exposed to
the browser (hence the `VITE_` prefix) — a human-formatted number (e.g.
`+1 415 523 8886`) shown on the login page, the Home promo card, and
`ConnectWhatsAppView.jsx`'s explainer. Keep it in sync with whatever number
`TWILIO_WHATSAPP_FROM` actually points at for that project — they're not
read from the same source since the server-only var carries the `whatsapp:`
scheme prefix Twilio's API needs, not a display-ready string. `TWILIO_NUDGE_TEMPLATE_SID`
is the Meta-approved Content Template used for the "N items waiting for
review" nudge (`api/whatsapp-webhook.js`'s `maybeNudgeModerators`) — unset
in any environment, nudges are silently skipped rather than failing
whatever request would have triggered one.

None of these are ever committed — confirmed: no `.env*` file is tracked in
this repo (`git ls-files | grep env` returns nothing). Local development
reads `.env.local`, which is git-ignored.

One more secret, GitHub-side rather than Vercel-side: `SUPABASE_ACCESS_TOKEN`,
a repo secret (Settings → Secrets and variables → Actions) that CI's
`check-migrations-synced` job (`.github/workflows/ci.yml`) uses to confirm
every migration in `supabase/migrations/` has actually been applied to the
relevant project — see `scripts/check-migrations-synced.sh` for why this
exists. Generate it from the Supabase Dashboard → Account → Access Tokens
(a personal access token, not a project API key — it only needs to list/
query projects you already have access to). This is the one secret in this
project that isn't scoped to a single Vercel project, since the same check
runs against both test and production from one workflow.

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

## A second real gotcha — Supabase Auth's Site URL (2026-10-15)

Both Supabase projects' **Auth → URL Configuration → Site URL** had
silently been left at the project-creation default, `http://localhost:3000`
(or `http://127.0.0.1:3000`), with an empty redirect allow-list. Every
confirmation/magic-link email Supabase Auth sends is built from this
setting whenever the calling code doesn't pass its own `emailRedirectTo` —
and the app's main sign-up call didn't. Caught when a real self-registered
user clicked their confirmation email and landed on an unreachable
`localhost:3000` — meaning **every real self-registration on production
was silently broken** from the moment the production Supabase project was
created until this was found and fixed, not a recent regression.

**Fixed two ways, deliberately redundant:**
- Both projects' `site_url`/`uri_allow_list` corrected via the Management
  API (`PATCH /v1/projects/<ref>/config/auth`) to their real domain —
  `oursamskara.com` for production, `samskara-koaham.vercel.app` for test.
- `AuthPanel.jsx`'s two `signUp()` calls now pass `emailRedirectTo`
  explicitly (`window.location.origin`, or the full `window.location.href`
  for the invite-redemption path, so confirming returns someone straight to
  their invite link rather than just the site root) — so a correct
  redirect no longer depends on the project-level setting ever being right
  again.

Lesson for next time: **after creating any new Supabase project, check
Auth → URL Configuration before the first real signup happens** — this is
exactly the kind of setting that works perfectly in local dev (where
`localhost:3000` *is* correct) and so is never caught until exercised for
real, by a real external user, which is the worst time to find out.

## What's deliberately different

- **Supabase plan**: test can stay on Free; production is Pro (daily
  backups, more compute) — see `docs/BACKUPS.md` for why Pro alone still
  isn't sufficient on its own.
- **Data lifecycle**: test data is disposable by design; production data
  needs the real backup discipline `docs/BACKUPS.md` already describes, now
  pointed at the production project's keys specifically.
