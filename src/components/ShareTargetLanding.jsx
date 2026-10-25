import { useEffect, useState } from "react";

// Landing spot for Android/Chrome's native Share sheet (see share_target in
// vite.config.js's manifest). src/sw.js's fetch listener already caught the
// real POST and redirected here with just `?id=` — the shared text/file
// themselves are sitting in a scratch Cache Storage entry under that id,
// since a redirect can't carry a File object. This reads them back out,
// hands them to the existing contribute flow, and throws the scratch entry
// away either way (nothing here should survive a second visit to this URL).
const SHARE_CACHE = "share-target-inbox";
const ID_FROM_URL = new URLSearchParams(window.location.search).get("id");

export default function ShareTargetLanding({ onReady, onDone }) {
  const [error, setError] = useState("");

  useEffect(() => {
    window.history.replaceState({}, "", window.location.pathname);
    if (!ID_FROM_URL) {
      setError("Nothing was shared.");
      return;
    }
    (async () => {
      try {
        const cache = await caches.open(SHARE_CACHE);
        const metaRes = await cache.match(`/share-target-data/${ID_FROM_URL}`);
        if (!metaRes) throw new Error("That shared item has expired — try sharing again.");
        const meta = await metaRes.json();

        let photoFile = null;
        if (meta.hasFile) {
          const fileRes = await cache.match(`/share-target-file/${ID_FROM_URL}`);
          if (fileRes) {
            const blob = await fileRes.blob();
            photoFile = new File([blob], "shared", { type: blob.type });
          }
        }

        await cache.delete(`/share-target-data/${ID_FROM_URL}`);
        await cache.delete(`/share-target-file/${ID_FROM_URL}`);

        // Anything shared with no photo is treated as a memory (plain text
        // or a shared link) — OS share can only ever start a brand-new
        // contribution, never target a specific person or edit an existing
        // folio field, so there's no personId to carry through here.
        const text = [meta.title, meta.text, meta.url].filter(Boolean).join("\n").trim();
        onReady({ ...(photoFile ? { photoFile } : {}), ...(text ? { text } : {}) });
      } catch (err) {
        setError(err.message || "Couldn't read what was shared.");
      }
    })();
  }, [onReady]);

  if (error) {
    return (
      <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="card" style={{ padding: 24 }}>
          <p>{error}</p>
          <button type="button" className="btn ghost" style={{ marginTop: 16 }} onClick={onDone}>Back to Samskara</button>
        </div>
      </section>
    );
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="card" style={{ padding: 24 }}>
        <p className="form-hint">Bringing that into Samskara…</p>
      </div>
    </section>
  );
}
