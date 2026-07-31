// Downscales an uploaded image file to a JPEG, returning both a data URL
// (for an instant local preview) and a Blob (for the actual Supabase
// Storage upload) — resizing once and reusing the result for both.
// 1600 keeps every photo crisp everywhere it's actually displayed —
// full-screen PhotoLightbox on a retina phone, Gallery cards, Admin queue
// previews — while still compressing a modern phone's 3000-4000px camera
// output well below the storage/bandwidth cost of the original. (Was 320,
// sized only for small avatar-scale thumbnails; every one of those still
// downscales further at display time via CSS, so raising this doesn't cost
// them anything — it only fixes every larger view that was stretching a
// 320px source past its real resolution.)
export function resizeImage(file, maxSize = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like a valid image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        canvas.toBlob((blob) => resolve({ dataUrl, blob }), "image/jpeg", 0.85);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
