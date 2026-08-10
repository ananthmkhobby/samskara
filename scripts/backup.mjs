// Off-site backup of everything a family would grieve losing: the database
// rows and the media files themselves.
//
// Why this exists even once the project is on Supabase's Pro plan: Pro keeps
// seven days of daily backups, which protects against infrastructure failure
// but not against the failure this app is actually likely to suffer — someone
// deleting or overwriting something and nobody noticing for a month. These
// snapshots are kept as long as you keep them, and they live somewhere the
// Supabase project can't reach, so a mistake (or a compromised service key)
// on that side can't take the backups with it.
//
// Reads every table with the service role key, so RLS is bypassed and all
// families are captured, and downloads every object in the private
// family-media bucket.
//
// Usage:
//   node scripts/backup.mjs [output-dir]
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (or a .env.local alongside package.json, for running it by hand).

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BUCKET = "family-media";

// Every table worth restoring from. Listed explicitly rather than discovered
// from the catalog so that a table added later is a deliberate decision to
// back up, not something that silently starts or stops being included.
//
// Deliberately excluded: ai_usage_daily, which is just today's rate-limit
// counters — losing it costs nothing and restoring it would be meaningless.
const TABLES = [
  "families",
  "family_members",
  "people",
  "marriages",
  "contributions",
  "experience_entries",
  "family_books",
  "book_ownership",
  "book_readers",
  "practice_logs",
  "invites",
  "user_consents",
];

async function loadEnv() {
  const envFile = path.join(process.cwd(), ".env.local");
  if (existsSync(envFile)) {
    const text = await readFile(envFile, "utf8");
    for (const line of text.split("\n")) {
      const i = line.indexOf("=");
      if (i < 1 || line.trimStart().startsWith("#")) continue;
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  return { url, key };
}

// PostgREST caps a single response, so everything is read in pages — a family
// archive that outgrows one page must not end up silently half-backed-up.
async function fetchAll(db, table) {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function listAllObjects(db, prefix = "") {
  const found = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`storage list "${prefix}": ${error.message}`);
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A directory placeholder has no id; anything else is a real object.
      if (entry.id) found.push(full);
      else found.push(...await listAllObjects(db, full));
    }
    if (data.length < PAGE) break;
  }
  return found;
}

async function main() {
  const { url, key } = await loadEnv();
  const db = createClient(url, key, { auth: { persistSession: false } });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const outDir = path.resolve(process.argv[2] || `backups/${stamp}`);
  await mkdir(path.join(outDir, "data"), { recursive: true });
  await mkdir(path.join(outDir, "media"), { recursive: true });

  const summary = { takenAt: new Date().toISOString(), tables: {}, media: { files: 0, bytes: 0 }, errors: [] };

  for (const table of TABLES) {
    try {
      const rows = await fetchAll(db, table);
      await writeFile(path.join(outDir, "data", `${table}.json`), JSON.stringify(rows, null, 2));
      summary.tables[table] = rows.length;
      console.log(`  ${table}: ${rows.length} rows`);
    } catch (err) {
      // One missing or renamed table shouldn't abandon the whole backup —
      // a partial snapshot beats none, as long as the gap is recorded.
      summary.errors.push(err.message);
      console.error(`  ${table}: FAILED — ${err.message}`);
    }
  }

  console.log("Media:");
  const objects = await listAllObjects(db);
  for (const objectPath of objects) {
    try {
      const { data, error } = await db.storage.from(BUCKET).download(objectPath);
      if (error) throw new Error(error.message);
      const buf = Buffer.from(await data.arrayBuffer());
      const dest = path.join(outDir, "media", objectPath);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      summary.media.files++;
      summary.media.bytes += buf.length;
    } catch (err) {
      summary.errors.push(`media ${objectPath}: ${err.message}`);
      console.error(`  ${objectPath}: FAILED — ${err.message}`);
    }
  }
  console.log(`  ${summary.media.files} files, ${(summary.media.bytes / 1048576).toFixed(1)} MB`);

  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(summary, null, 2));
  console.log(`\nBackup written to ${outDir}`);

  // A non-zero exit on partial failure so a scheduled run shows up as failed
  // rather than quietly producing an incomplete snapshot nobody looks at.
  if (summary.errors.length) {
    console.error(`\n${summary.errors.length} item(s) failed — see manifest.json`);
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
