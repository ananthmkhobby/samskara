// One-time migration: copies every real family from the source project
// (.env.local) into the production project (.env.prod.local), in three
// phases — auth accounts, data tables, media files.
//
// Scoped to exactly the tables scripts/backup.mjs already treats as
// "irreplaceable" (see that file's own comment on why ai_usage_daily and
// other operational-only tables are deliberately excluded — the same
// reasoning applies here: whatsapp_connections, gallery_export_codes, and
// duplicate_dismissals all start fresh in production rather than being
// migrated, since they're either cheap to regenerate or meaningless to
// carry over onto newly-recreated auth accounts).
//
// Auth accounts cannot be copied directly (see docs/BACKUPS.md) — this
// recreates each one with a fresh random password via the admin API, and
// writes a report of old-email -> new-password to migration-output/ (never
// committed — see .gitignore) for distributing to each family's Admin.
//
// Safe by default: running with no flags only PRINTS what it would do.
// Nothing is written to the destination until you pass --apply.
//
// Usage:
//   node scripts/migrate-to-prod.mjs            # dry run
//   node scripts/migrate-to-prod.mjs --apply     # actually writes

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BUCKET = "family-media";
const APPLY = process.argv.includes("--apply");

// Confirmed test/seed data, not real families — see docs/CHANGELOG.md's
// 2026-10-15 migration entry for how this was identified (an @example.com
// head account, the reserved-for-documentation email domain, on an
// otherwise all-real-address family; three further accounts with no
// family_members row at all, left over from invite-redemption testing).
const EXCLUDE_FAMILY_IDS = new Set([
  "51056680-9e30-4106-b623-2e6cac36da99", // Bhandari Family (test data)
  // The public demo tenant — fixed id, seeded by its own migration
  // (supabase/migrations/..._multitenant_schema.sql and friends), already
  // present in samskara-prod before this script ever runs. Migrating it
  // again from source created duplicate-content rows in any table without
  // a stable natural key (marriages' id is gen_random_uuid(), not
  // deterministic like people's text slug — see docs/CHANGELOG.md's
  // 2026-10-15 entry for the cleanup this required).
  "00000000-0000-0000-0000-000000000001",
]);
const EXCLUDE_EMAILS = new Set([
  "_bhandari_head@example.com",
  "test-redeem-b-1785340997706@example.com",
  "test-redeem-a-1785340997549@example.com",
  "test-redeem-1785340969893@example.com",
]);

// Same list and order as scripts/backup.mjs, with the auth-FK column(s) for
// each table (if any) named explicitly — the one new piece of bookkeeping
// this script needs that a plain backup doesn't.
// Order matters beyond what docs/BACKUPS.md documents: family_members.person_id
// and invites.person_id were both added by later migrations as FKs into
// people(family_id, id) — so people must be restored before either of them,
// not after, despite BACKUPS.md's original (now slightly stale) ordering.
const TABLES = [
  { name: "families", familyIdCol: "id" },
  { name: "people" },
  { name: "marriages" },
  { name: "family_members", userCols: ["user_id"] },
  // "generated always as identity" bigint PKs — Postgres refuses an
  // explicit id for these outright (a real error hit during the actual
  // migration run, see docs/CHANGELOG.md). These get a fresh id on insert
  // rather than preserving the original, which is safe for all of them
  // EXCEPT family_books: contributions.book_id, book_ownership.book_id and
  // book_readers.book_id all reference family_books(id) by its original
  // identity value, so family_books has to come first and keep its real
  // ids intact as a special case (see bookIdRemap handling below) rather
  // than being stripped like the others.
  { name: "family_books", userCols: ["contributor_user_id"], identityId: true, isBookTable: true },
  { name: "book_ownership", identityId: true, bookIdCol: "book_id" },
  { name: "book_readers", identityId: true, bookIdCol: "book_id" },
  { name: "contributions", userCols: ["contributor_user_id"], identityId: true, bookIdCol: "book_id" },
  { name: "experience_entries", identityId: true },
  { name: "practice_logs", userCols: ["contributor_user_id"], identityId: true },
  { name: "invites", userCols: ["created_by", "used_by"] },
  // No family_id column — a global per-user record. Excluded instead by
  // user_id, via excludedUserIds built from EXCLUDE_EMAILS below.
  { name: "user_consents", userCols: ["user_id"], noFamilyId: true, identityId: true },
];

async function loadEnvFile(file) {
  const env = {};
  if (!existsSync(file)) return env;
  const text = await readFile(file, "utf8");
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

function client(env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL/service key in env file.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

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
      if (entry.id) found.push(full);
      else found.push(...await listAllObjects(db, full));
    }
    if (data.length < PAGE) break;
  }
  return found;
}

function genPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[/+=]/g, "").slice(0, 12);
}

async function listAllAuthUsers(db) {
  let users = [], page = 1;
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) break;
    page++;
  }
  return users;
}

async function main() {
  const sourceEnv = await loadEnvFile(path.join(process.cwd(), ".env.local"));
  const destEnv = await loadEnvFile(path.join(process.cwd(), ".env.prod.local"));
  const source = client(sourceEnv);
  const dest = client(destEnv);

  console.log(APPLY ? "*** APPLY MODE — this will write to samskara-prod ***" : "Dry run — nothing will be written. Pass --apply to actually migrate.");
  console.log("");

  // ---- Phase 1: auth accounts ----
  console.log("Phase 1: auth accounts");
  const allSourceUsers = await listAllAuthUsers(source);
  const excludedUserIds = new Set(allSourceUsers.filter((u) => EXCLUDE_EMAILS.has(u.email)).map((u) => u.id));
  const sourceUsers = allSourceUsers.filter((u) => !EXCLUDE_EMAILS.has(u.email));
  console.log(`  ${allSourceUsers.length} account(s) in source, ${excludedUserIds.size} excluded (test data), ${sourceUsers.length} to migrate.`);

  const idMap = new Map(); // old user id -> new user id
  const credentials = []; // { email, password } for the report

  if (APPLY) {
    const destUsers = await listAllAuthUsers(dest);
    const destByEmail = new Map(destUsers.map((u) => [u.email?.toLowerCase(), u]));

    for (const u of sourceUsers) {
      const existing = u.email ? destByEmail.get(u.email.toLowerCase()) : null;
      if (existing) {
        // Re-running after a partial migration: don't recreate, don't
        // regenerate a password for an account that already exists.
        idMap.set(u.id, existing.id);
        console.log(`  ${u.email}: already exists in prod, reusing.`);
        continue;
      }
      const password = genPassword();
      const { data, error } = await dest.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: u.user_metadata,
      });
      if (error) throw new Error(`creating ${u.email}: ${error.message}`);
      idMap.set(u.id, data.user.id);
      credentials.push({ email: u.email, password });
      console.log(`  ${u.email}: created.`);
    }

    // Timestamped to the second (not just the date) and only written when
    // there's something real in it — a re-run that creates zero new
    // accounts must never overwrite an earlier run's real passwords with an
    // empty file. (This exact bug happened once during real migration —
    // see docs/CHANGELOG.md's 2026-10-15 entry.)
    if (credentials.length) {
      await mkdir("migration-output", { recursive: true });
      const report = credentials.map((c) => `${c.email},${c.password}`).join("\n");
      const reportFile = `migration-output/new-passwords-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      await writeFile(reportFile, `email,temporary_password\n${report}\n`);
      console.log(`  New-account passwords written to ${reportFile} — not committed, distribute to each family's Admin then delete.`);
    } else {
      console.log("  No new accounts created this run — nothing to write.");
    }
  } else {
    for (const u of sourceUsers) console.log(`  would create: ${u.email}`);
  }
  console.log("");

  // ---- Phase 2: data tables ----
  console.log("Phase 2: data tables");
  const bookIdMap = new Map(); // old family_books.id -> new id (it's identityId, so its id is never preserved)
  for (const { name: table, userCols, familyIdCol, noFamilyId, identityId, isBookTable, bookIdCol } of TABLES) {
    let rows = await fetchAll(source, table);
    const before = rows.length;
    rows = noFamilyId
      ? rows.filter((r) => !excludedUserIds.has(r.user_id))
      : rows.filter((r) => !EXCLUDE_FAMILY_IDS.has(r[familyIdCol || "family_id"]));
    const excluded = before - rows.length;
    if (userCols) {
      for (const row of rows) {
        for (const col of userCols) {
          if (row[col]) row[col] = APPLY ? (idMap.get(row[col]) ?? null) : row[col];
        }
      }
    }
    if (bookIdCol && APPLY) {
      for (const row of rows) {
        if (row[bookIdCol] != null) row[bookIdCol] = bookIdMap.get(row[bookIdCol]) ?? null;
      }
    }
    console.log(`  ${table}: ${rows.length} row(s)${excluded ? ` (${excluded} excluded as test data)` : ""}${userCols ? ` (remapping ${userCols.join(", ")})` : ""}${bookIdCol ? " (remapping book_id)" : ""}`);
    if (APPLY && rows.length) {
      if (identityId) {
        // Can't upsert-by-id (Postgres rejects an explicit value for a
        // GENERATED ALWAYS AS IDENTITY column outright), and re-running
        // this table after a previous successful insert would duplicate
        // its rows. A blind table-wide count is the wrong check — the
        // destination's pre-existing demo-family rows made that look
        // "already migrated" when the real data hadn't been written yet
        // (see docs/CHANGELOG.md's 2026-10-15 entry). Scope the check to
        // specifically the family_ids this run is about to write instead.
        const migratingFamilyIds = [...new Set(rows.map((r) => r.family_id).filter(Boolean))];
        // user_consents has no family scope, so the check is by (already-
        // remapped) user_id instead — same idea, different column.
        const migratingUserIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
        const { count } = noFamilyId
          ? await dest.from(table).select("*", { count: "exact", head: true }).in("user_id", migratingUserIds)
          : await dest.from(table).select("*", { count: "exact", head: true }).in("family_id", migratingFamilyIds);
        if (count > 0) {
          console.log(`    (destination already has ${count} row(s) for these families — skipping, assumed already migrated)`);
          // Even when skipping the insert, a re-run needs bookIdMap populated
          // from what's already there, or every later table's book_id would
          // remap to null instead of pointing at the real existing books.
          if (isBookTable) {
            const { data: existing } = await dest.from(table).select("id, family_id, title").in("family_id", migratingFamilyIds);
            const srcByKey = new Map(rows.map((r) => [`${r.family_id}|${r.title}`, r.id]));
            for (const row of existing ?? []) {
              const oldId = srcByKey.get(`${row.family_id}|${row.title}`);
              if (oldId != null) bookIdMap.set(oldId, row.id);
            }
          }
        } else if (isBookTable) {
          const stripped = rows.map(({ id, ...rest }) => rest);
          const { data: inserted, error } = await dest.from(table).insert(stripped).select("id");
          if (error) throw new Error(`writing ${table}: ${error.message}`);
          // supabase-js/PostgREST preserves input order in the returned rows
          // for a single insert call, so zipping position-for-position with
          // the original (unstripped) rows recovers each old-id -> new-id pair.
          rows.forEach((row, i) => bookIdMap.set(row.id, inserted[i].id));
        } else {
          const stripped = rows.map(({ id, ...rest }) => rest);
          const { error } = await dest.from(table).insert(stripped);
          if (error) throw new Error(`writing ${table}: ${error.message}`);
        }
      } else {
        // onConflict omitted deliberately — upsert then targets each
        // table's own primary key by default, correct for all of these
        // (including people's composite family_id+id key).
        const { error } = await dest.from(table).upsert(rows);
        if (error) throw new Error(`writing ${table}: ${error.message}`);
      }
    }
  }
  console.log("");

  // ---- Phase 3: media files ----
  console.log("Phase 3: media files");
  const allObjects = await listAllObjects(source);
  const objects = allObjects.filter((p) => ![...EXCLUDE_FAMILY_IDS].some((fid) => p.startsWith(`${fid}/`)));
  console.log(`  ${allObjects.length} file(s) in source bucket "${BUCKET}", ${allObjects.length - objects.length} excluded as test data, ${objects.length} to copy.`);
  if (APPLY) {
    let copied = 0;
    for (const objectPath of objects) {
      const { data, error } = await source.storage.from(BUCKET).download(objectPath);
      if (error) { console.error(`  FAILED download ${objectPath}: ${error.message}`); continue; }
      const buf = Buffer.from(await data.arrayBuffer());
      const { error: upErr } = await dest.storage.from(BUCKET).upload(objectPath, buf, { contentType: data.type, upsert: true });
      if (upErr) { console.error(`  FAILED upload ${objectPath}: ${upErr.message}`); continue; }
      copied++;
    }
    console.log(`  ${copied}/${objects.length} file(s) copied.`);
  }

  console.log("\nDone." + (APPLY ? "" : " Re-run with --apply to actually migrate."));
}

main().catch((err) => { console.error(err); process.exit(1); });
