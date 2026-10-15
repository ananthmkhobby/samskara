# Git workflow

Three branches, each with one job. Nothing is deployed from a developer's
machine — every environment only ever updates from a push Vercel sees, which
is what makes the deployment log itself usable as audit evidence (commit SHA
→ build → live URL, all timestamped by Vercel, not self-reported).

```
feature work  →  dev  →  (test deploy, verified)  →  PR  →  main  →  (prod deploy)
                                                               │
                                                               └─▶ master (fast-forward)
                                                               └─▶ tag vYYYY.MM.DD
```

| Branch | What it's for | Who can push directly | Deploys to |
|---|---|---|---|
| `dev` | All work lands here first. | Anyone on the project | Existing Vercel project → `samskara-koaham.vercel.app` (test) |
| `main` | Release branch. Reached only via a reviewed PR from `dev`. | No one — PR only | New Vercel project → `oursamskara.com` (production) |
| `master` | Golden copy — fast-forwarded to match `main` right after a healthy production deploy. Never developed on. | No one — fast-forward only, via the release command below | Nothing — it's a rollback anchor, not an environment |

## Day to day

```bash
git checkout dev
git pull
# ...make changes...
git add <files>
git commit -m "..."
git push
```

Vercel's existing project auto-deploys `dev` on every push. Verify there
before anything moves further — this *is* the test environment.

## Cutting a release

Once `dev` is verified on the test domain:

```bash
gh pr create --base main --head dev --title "Release: <short summary>" \
  --body "What changed, what was tested, links to the test-case entries."
```

Fill in the [PR template](../.github/pull_request_template.md)'s checklist
honestly — that checklist, filled in, is the audit evidence for this release.
Merge only after it's checked.

After the merge triggers a production deploy and you've confirmed it's
healthy (the post-deploy smoke test in the PR template):

```bash
git checkout main && git pull
git checkout master && git merge --ff-only main && git push
git tag v$(date +%Y.%m.%d) main
git push origin --tags
```

If `--ff-only` refuses, `master` has diverged from a straight line of
releases — stop and figure out why before forcing anything; it means either
someone pushed directly to `master` (shouldn't happen) or a release was
skipped.

## Rolling back

Two layers, fastest first:

1. **Vercel's own deployment history** — every previous production deploy is
   still live at its own URL. Promoting a prior one to production takes
   seconds and needs no git operation at all. Use this first for anything
   urgent.
2. **Git, via the tag** — `git checkout vX.Y.Z` reproduces the exact released
   source for a fresh deploy, if you need to rebuild rather than just
   re-promote.

`master` always points at the last known-good release either way, so it's
always the answer to "what's actually live right now" without needing to
check a tag list.

## Hotfixes

A bug in production that can't wait for the normal `dev` → test → `main`
cycle: branch from `main` (not `dev`, which may already hold unreleased
work), fix, PR back into `main` the same way, then **also merge `main` back
into `dev`** so the fix isn't silently lost on the next regular release.
