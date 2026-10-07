#!/usr/bin/env node
// Developer-only tool: computes and stores a perceptual hash (dHash, see
// src/lib/imageHash.js) for every photo contribution that doesn't have one
// yet — i.e. every photo uploaded before that column/feature existed.
// Never bundled into the app, run locally with the service-role key, which
// bypasses RLS so this covers every family in one run.
//
// Usage: npm run backfill-image-hashes
import { createClient } from "@supabase/supabase-js";
import { Jimp } from "jimp";
import { computeDHash } from "../src/lib/imageHash.js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — run via `npm run backfill-image-hashes` (loads .env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const BUCKET = "family-media";
const PAGE_SIZE = 200;

async function main() {
  let processed = 0, hashed = 0, skipped = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("contributions")
      .select("id, content")
      .eq("type", "photo")
      .is("image_hash", null)
      .not("content", "is", null)
      .limit(PAGE_SIZE);
    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!rows.length) break;

    for (const row of rows) {
      processed++;
      try {
        const { data: blob, error: downloadErr } = await supabase.storage.from(BUCKET).download(row.content);
        if (downloadErr) throw new Error(downloadErr.message);
        const buffer = Buffer.from(await blob.arrayBuffer());
        const img = await Jimp.read(buffer);
        img.resize({ w: 32, h: 32 }).greyscale();
        const hash = computeDHash(img.bitmap);
        const { error: updateErr } = await supabase.from("contributions").update({ image_hash: hash }).eq("id", row.id);
        if (updateErr) throw new Error(updateErr.message);
        hashed++;
      } catch (err) {
        // A missing/broken Storage object (deleted file, corrupt upload,
        // etc.) should never abort the whole backfill — skip and log, same
        // discipline the photobook export already uses for broken media.
        console.error(`  skipped contribution ${row.id} (${row.content}): ${err.message}`);
        skipped++;
        // Mark it so this row doesn't get re-queried forever on a
        // permanently-broken object — an empty string is distinguishable
        // from "not yet processed" (null) without being a valid hash.
        await supabase.from("contributions").update({ image_hash: "" }).eq("id", row.id);
      }
    }
  }

  console.log(`\nDone. Processed ${processed}, hashed ${hashed}, skipped ${skipped}.\n`);
}

main().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
