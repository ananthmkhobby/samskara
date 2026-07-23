// Calls one of this project's /api/* serverless functions. Those only run
// when deployed (or under `vercel dev`) — plain `vite dev` doesn't execute
// them, so this gives a clear message instead of a raw JSON-parse error in
// that case.
export async function callApi(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
