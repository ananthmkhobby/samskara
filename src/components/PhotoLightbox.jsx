// Shared full-screen viewer for any already-uploaded photo — the Folio
// profile photo, "Their Experience" cards, the Media gallery, and
// Parampara entries all open the same lightbox rather than each building
// their own overlay.
export default function PhotoLightbox({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div className="photo-lightbox" onClick={onClose}>
      <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      <img src={src} alt={alt || ""} />
    </div>
  );
}
