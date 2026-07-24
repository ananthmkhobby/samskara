#!/usr/bin/env node
// Developer-only tool: creates a new family + its head's login account in
// one shot. Never bundled into the app (lives outside src/, run locally
// with the service-role key, which must never reach the client or Vercel).
//
// Usage: npm run provision-family -- "Sharma Family" head@example.com "Head's Name"
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const [, , familyName, headEmail, headName] = process.argv;

if (!familyName || !headEmail) {
  console.error('Usage: npm run provision-family -- "Family Name" head@example.com ["Head\'s Name"]');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — run via `npm run provision-family` (loads .env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function generatePassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[/+=]/g, "").slice(0, 12);
}

async function main() {
  const password = generatePassword();

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: headEmail,
    password,
    email_confirm: true, // no email-sending is configured — skip confirmation entirely
  });
  if (userError) throw new Error(`Creating auth user failed: ${userError.message}`);
  const userId = userData.user.id;

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: familyName })
    .select()
    .single();
  if (familyError) throw new Error(`Creating family failed: ${familyError.message}`);

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: userId, role: "head", display_name: headName || null });
  if (memberError) throw new Error(`Linking head to family failed: ${memberError.message}`);

  console.log("\nFamily provisioned:\n");
  console.log(`  Family:              ${familyName}`);
  console.log(`  Family ID:           ${family.id}`);
  console.log(`  Head email:          ${headEmail}`);
  console.log(`  Temporary password:  ${password}`);
  console.log("\nHand these credentials to the family head out-of-band. There's no");
  console.log("self-serve password reset yet — a forgotten password needs another");
  console.log("script call (auth.admin.updateUserById) or the Supabase dashboard.\n");
}

main().catch((err) => {
  console.error("Provisioning failed:", err.message);
  process.exit(1);
});
