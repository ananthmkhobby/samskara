import { useEffect, useState } from "react";

// Shared full-screen viewer for any already-uploaded photo — the Folio
// profile photo, "Their Experience" cards, the Media gallery, the family
// logo, and Parampara entries all open the same lightbox rather than each
// building their own overlay. Tapping the backdrop or the close button
// minimises it back to whatever grid/thumbnail it was opened from; tapping
// the image itself toggles between "fit to screen" and its true resolution
// (scrollable) so a photo with fine detail can actually be zoomed into.
export default function PhotoLightbox({ src, alt, onClose }) {
  const [zoomed, setZoomed] = useState(false);

  // A fresh photo should always open fitted, not still zoomed from
  // whichever photo was open before it.
  useEffect(() => { setZoomed(false); }, [src]);

  if (!src) return null;
  return (
    <div className={`photo-lightbox${zoomed ? " is-zoomed" : ""}`} onClick={onClose}>
      <button className="modal-close" onClick={onClose} aria-label="Minimise">✕</button>
      <img
        src={src}
        alt={alt || ""}
        className={zoomed ? "is-zoomed" : ""}
        onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
      />
    </div>
  );
}
