export const PhotoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-4 4-3-3-6 6" /></svg>
);
export const AudioIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
export const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M15 10l6-3v10l-6-3z" /></svg>
);
export const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /></svg>
);
export const EditPencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16.5 3.5l4 4L7 21l-4.5 1L4 17.5z" /></svg>
);
export const DateIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3.5" y="5" width="17" height="16" rx="2" /><line x1="3.5" y1="10" x2="20.5" y2="10" /></svg>
);
export const MemoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4h16v13H8l-4 4z" /></svg>
);

export const MEDIA_ICONS = { photo: PhotoIcon, audio: AudioIcon, video: VideoIcon, document: DocumentIcon };

export const AUDIO_EXP_TYPES = ["voice", "laugh", "song", "prayer"];
export const EXP_LABELS = {
  voice: "Voice", laugh: "Laugh", song: "Favourite song", prayer: "Prayer recited",
  story: "Story", advice: "Advice", recipe: "Family recipe", handwriting: "Handwriting",
  signature: "Signature", achievement: "Achievement", lesson: "Mistake & lesson", photo: "Photograph"
};
// Which experience categories make sense to offer for a given kind of
// contribution — e.g. "favourite song" only fits an audio recording, while a
// photo upload is naturally a "Photograph", "Signature", or "Handwriting"
// (a snapshot of something written), not "voice" or "laugh".
export const EXP_CATEGORIES_BY_TYPE = {
  memory: ["story", "advice", "achievement", "lesson", "recipe"],
  audio: ["voice", "laugh", "song", "prayer"],
  video: ["story", "achievement"],
  photo: ["photo", "signature", "handwriting", "achievement"],
  document: ["handwriting", "signature", "recipe", "achievement"]
};
export const ExpIcon = ({ type }) => {
  const paths = {
    voice: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    laugh: <><circle cx="12" cy="12" r="9" /><path d="M8 13c1 2 2.5 3 4 3s3-1 4-3" /><path d="M8.5 9h.01M15.5 9h.01" /></>,
    song: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    prayer: <><path d="M12 3c1.5 3 2 5 2 7a2 2 0 0 1-4 0c0-2 .5-4 2-7z" /><path d="M6 21c0-4 2.5-6 6-6s6 2 6 6" /></>,
    story: <path d="M4 4h16v13H8l-4 4z" />,
    advice: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11.2c.4.3.6.8.6 1.3v.5h4.8v-.5c0-.5.2-1 .6-1.3A6 6 0 0 0 12 3z" />,
    recipe: <><path d="M4 12a8 4 0 0 0 16 0z" /><path d="M4 12a8 4 0 0 1 16 0" /><path d="M12 3v4" /></>,
    handwriting: <><path d="M4 19h16" /><path d="M6 15.5 15.5 6l2.5 2.5L8.5 18 5 19z" /></>,
    signature: <path d="M3 17c2-1 3-3 3.5-5 .3 2 1 4 2.5 4s1.5-3 2.5-5 1.5 4 3 4 2-2 4-2" />,
    achievement: <path d="M12 15l-5.5 3 1-6L3 8l6-1 3-6 3 6 6 1-4.5 4 1 6z" />,
    lesson: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    photo: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-4 4-3-3-6 6" /></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{paths[type] || paths.story}</svg>;
};
