<!--
This checklist, filled in honestly, IS the audit evidence for this change —
see docs/SDLC.md. Delete a section only if it's genuinely not applicable,
and say why in one word (e.g. "docs-only").
-->

## What changed and why

<!-- One or two sentences. Link an Issue if one exists. -->

## Security & privacy

- [ ] Touches auth, RLS policies, or who-can-see-what? → describe the exact change
- [ ] Touches secrets or environment variables? → confirm none are logged or committed
- [ ] Touches personal data (photos, recordings, names, contact info)? → confirm it stays inside the existing RLS boundary
- [ ] None of the above

## Testing

- [ ] Verified on the `dev` test deploy (`samskara-koaham.vercel.app`) — describe what you checked
- [ ] Added/updated an entry in `docs/test-cases/`
- [ ] No automated test exists for this path yet (expected for most of the app today — see `docs/SDLC.md`'s gap list)

## Performance / scalability

- [ ] Could this meaningfully increase load (new query pattern, new storage/AI usage, new cron)? → describe
- [ ] No meaningful impact

## Post-merge (fill in after this reaches `main` and deploys)

- [ ] Smoke-tested against `oursamskara.com` after deploy
- [ ] `master` fast-forwarded and tagged per `docs/GIT_WORKFLOW.md`
- [ ] `docs/CHANGELOG.md` entry added
