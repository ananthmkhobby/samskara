# Backing up the archive

## Why this exists

Supabase's **Free plan has no automatic backups at all** — their own guidance is
that free-tier projects should export their own data and keep off-site copies.
The **Pro plan ($25/month)** adds daily backups with 7-day retention.

Even on Pro, that seven-day window protects against infrastructure failure but
not against the failure this app is actually likely to suffer: someone deletes
or overwrites something and nobody notices for a month. `scripts/backup.mjs`
covers that gap, and it keeps a copy somewhere the Supabase project itself
cannot reach — so a mistake, or a leaked service key, can't take the backups
along with the original.

**Both are worth having.** Upgrading to Pro is still the first thing to do; this
script is the second, not a substitute.

## What a snapshot contains

```
backups/2026-08-10-17-28-45/
  manifest.json          what was captured, when, and anything that failed
  data/                  one JSON file per table (people.json, contributions.json, …)
  media/<family_id>/…    every photo, recording and document, original bytes
```

Excluded on purpose: `ai_usage_daily` (today's rate-limit counters — worthless to
restore). Auth accounts themselves are **not** included; Supabase Auth users live
outside the tables the service key can export this way, so a full disaster
recovery would mean recreating logins and re-issuing passwords. The archive's
contents — which is the irreplaceable part — are fully covered.

## Running one by hand

```bash
npm run backup
```

Writes to `backups/<timestamp>/`, which is git-ignored. Needs `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`; it reads `.env.local` automatically. Pass a path to
write somewhere else — for example, straight into a synced folder:

```bash
node scripts/backup.mjs ~/Library/Mobile\ Documents/com~apple~CloudDocs/samskara-backups/$(date +%F)
```

A run that hits any error still writes everything it *could* fetch, records the
failures in `manifest.json`, and exits non-zero — so a partial snapshot is never
mistaken for a clean one.

## Running it automatically

### Do NOT use GitHub Actions artifacts

**This repository is public.** Workflow artifacts on a public repository can be
downloaded by anyone, so a scheduled Actions job uploading these snapshots would
publish every family's names, photos and voice recordings. Don't do it — not even
with a short retention. If you ever want CI to run backups, the destination has
to be private storage you control (S3, Cloudflare R2, Backblaze) with the
credentials in repository secrets.

### Weekly, on this Mac (launchd)

Simplest option that keeps the data private. Save as
`~/Library/LaunchAgents/app.samskara.backup.plist`, editing both paths:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>app.samskara.backup</string>
  <key>WorkingDirectory</key><string>/Users/YOU/koaham/vamsha-vruksha-app</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>scripts/backup.mjs</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>21</integer></dict>
  <key>StandardOutPath</key><string>/tmp/samskara-backup.log</string>
  <key>StandardErrorPath</key><string>/tmp/samskara-backup.err</string>
</dict>
</plist>
```

Then load it:

```bash
launchctl load ~/Library/LaunchAgents/app.samskara.backup.plist
```

Point the output at an iCloud- or Drive-synced folder (see the manual command
above) so the copy isn't sitting on the same disk as everything else. Check
`/tmp/samskara-backup.err` occasionally — a backup nobody verifies is a backup
that doesn't exist.

## Restoring

There is no one-command restore, deliberately — a restore is rare, always
partial, and worth doing carefully. The snapshots are plain JSON, so recovering
one deleted person or one lost recording is a matter of finding the row in
`data/people.json` (or the file under `media/`) and putting it back. For a total
loss, the tables must be reinserted in dependency order: `families`,
`family_members`, `people`, `marriages`, then everything else.
