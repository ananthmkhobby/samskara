import { supabase } from "./supabaseClient";

// Calls one of this project's /api/* serverless functions. Those only run
// when deployed (or under `vercel dev`) — plain `vite dev` doesn't execute
// them, so this gives a clear message instead of a raw JSON-parse error in
// that case. Attaches the caller's own access token whenever a session
// exists — harmless for endpoints that don't check it, and how the
// member-management endpoints confirm who's actually calling.
export async function callApi(path, body) {
  const headers = { "Content-Type": "application/json" };
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("This feature needs the app deployed (or run with `vercel dev`) — plain `npm run dev` doesn't run the /api functions.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
