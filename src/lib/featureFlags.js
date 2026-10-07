// Shared, codebase-wide feature toggles — same spirit as the per-file
// SHOW_CHITRASHALE (FolioModal.jsx) / SHOW_BANYAN_TOGGLE (TreeView.jsx)
// flags, pulled into one place because these two each touch more than one
// component and a single source of truth avoids one spot getting missed.
// Flip back to true when ready; nothing downstream is deleted.

// Hides every OpenAI-backed entry point (AI-guided interview, translate,
// scan-a-photo family-tree import) while the voice/accent quality and cost
// model are still being worked out. Browser-native speech-to-text (the
// voice wizard, dictation) is unaffected — it isn't AI-backed.
export const SHOW_AI_FEATURES = false;

// Hides the Folio's "Date of death" section entirely. Does not touch
// died/diedUnknown data already on record, or the "Late" name prefix
// elsewhere in the app (Tree, Search, etc.) — only this section's display.
export const SHOW_DATE_OF_DEATH = false;
