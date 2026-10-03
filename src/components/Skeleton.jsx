// A shimmering placeholder block for "content is loading" — in place of
// bare "Loading…" text, the only loading feedback most of the app had.
// Sized via props rather than a fixed set of variants, since the handful
// of real loading spots (a table row, a media tile) all need different
// shapes.
export default function Skeleton({ width = "100%", height = 14, radius, style }) {
  return (
    <span
      className="skeleton"
      style={{ width, height, borderRadius: radius ?? "var(--radius-sm)", ...style }}
      aria-hidden="true"
    />
  );
}
