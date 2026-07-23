import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { yearsLabel, MIN_GEN, MAX_GEN } from "../data/helpers";
import { EditPencilIcon } from "./Icons";
import PersonAvatar from "./PersonAvatar";

function ChapterContent({ chapter, onEdit, isOverridden, canModerate, onReset }) {
  return (
    <>
      <div className="chapter-head">
        <h3 className="chapter-title">{chapter.title}</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {canModerate && isOverridden && (
            <button className="btn small ghost" onClick={onReset}>Reset to auto-generated</button>
          )}
          <button className="icon-only" aria-label="Propose edit to this chapter" onClick={onEdit}><EditPencilIcon /></button>
        </div>
      </div>
      <div className="chapter-text">
        {chapter.text.split("\n\n").map((par, i) => <p key={i}>{par}</p>)}
      </div>
    </>
  );
}

export default function BiographyOverlay({ person, onClose, onEditChapter, canModerate, isChapterOverridden, onResetChapter }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [activeSide, setActiveSide] = useState("A");
  const [pageAChapter, setPageAChapter] = useState(0);
  const [pageBChapter, setPageBChapter] = useState(0);
  const pageARef = useRef(null);
  const pageBRef = useRef(null);
  const touchStartRef = useRef(null);

  function flipTo(newIndex, dir) {
    if (newIndex < 0 || newIndex >= person.chapters.length || newIndex === chapterIndex) return;
    const activeRef = activeSide === "A" ? pageARef : pageBRef;
    const standbyRef = activeSide === "A" ? pageBRef : pageARef;

    flushSync(() => {
      if (activeSide === "A") setPageBChapter(newIndex); else setPageAChapter(newIndex);
    });

    const origin = dir > 0 ? "left center" : "right center";
    const standbyEl = standbyRef.current;
    const activeEl = activeRef.current;
    standbyEl.style.transition = "none";
    standbyEl.style.transformOrigin = origin;
    standbyEl.style.transform = "rotateY(0deg)";
    standbyEl.style.zIndex = 1;
    activeEl.style.zIndex = 2;
    activeEl.style.transformOrigin = origin;
    const targetRot = dir > 0 ? "-179.9deg" : "179.9deg";
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function finish() {
      setChapterIndex(newIndex);
      setActiveSide((s) => (s === "A" ? "B" : "A"));
      activeEl.style.transition = "none";
      activeEl.style.transform = "rotateY(0deg)";
      activeEl.style.zIndex = 1;
    }
    if (reduce) {
      activeEl.style.transition = "none";
      activeEl.style.transform = `rotateY(${targetRot})`;
      finish();
    } else {
      requestAnimationFrame(() => {
        activeEl.style.transition = "transform .85s cubic-bezier(.45,.05,.2,1)";
        activeEl.style.transform = `rotateY(${targetRot})`;
      });
      activeEl.addEventListener("transitionend", finish, { once: true });
    }
  }

  function onTouchStart(e) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) flipTo(chapterIndex + 1, 1);
      else flipTo(chapterIndex - 1, -1);
    }
  }

  return (
    <div className="bio-overlay">
      <div className="bio-topbar">
        <b>{person.name} — Full biography</b>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn small" onClick={() => window.print()}>Download PDF</button>
          <button className="btn small ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="book">
        <div className="book-spread">
          <div className="book-left">
            <div className="book-left-band">
              <PersonAvatar person={person} size={84} minGen={MIN_GEN} maxGen={MAX_GEN} variant="band" className="avatar" />
              <h2>{person.name}</h2>
              <div className="years tnum">{yearsLabel(person)}</div>
            </div>
            <div className="toc">
              <div className="toc-label">Table of contents</div>
              {person.chapters.map((c, i) => (
                <button key={i} className={i === chapterIndex ? "active" : ""} onClick={() => flipTo(i, i > chapterIndex ? 1 : -1)}>
                  <span className="num tnum">{String(i + 1).padStart(2, "0")}</span>{c.title}
                </button>
              ))}
            </div>
          </div>
          <div className="book-right">
            <div className="flip-stack" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <div className="book-page" ref={pageARef} style={{ zIndex: activeSide === "A" ? 2 : 1 }}>
                <ChapterContent
                  chapter={person.chapters[pageAChapter]}
                  onEdit={() => onEditChapter(pageAChapter, person.chapters[pageAChapter].text)}
                  isOverridden={isChapterOverridden(pageAChapter)}
                  canModerate={canModerate}
                  onReset={() => onResetChapter(pageAChapter)}
                />
              </div>
              <div className="book-page" ref={pageBRef} style={{ zIndex: activeSide === "B" ? 2 : 1 }}>
                <ChapterContent
                  chapter={person.chapters[pageBChapter]}
                  onEdit={() => onEditChapter(pageBChapter, person.chapters[pageBChapter].text)}
                  isOverridden={isChapterOverridden(pageBChapter)}
                  canModerate={canModerate}
                  onReset={() => onResetChapter(pageBChapter)}
                />
              </div>
            </div>
            <p className="flip-hint">‹ swipe to turn the page ›</p>
            <div className="book-controls">
              <button className="btn small" disabled={chapterIndex === 0} onClick={() => flipTo(chapterIndex - 1, -1)}>← Previous</button>
              <span className="eyebrow tnum">Chapter {String(chapterIndex + 1).padStart(2, "0")} / {String(person.chapters.length).padStart(2, "0")}</span>
              <button className="btn small" disabled={chapterIndex === person.chapters.length - 1} onClick={() => flipTo(chapterIndex + 1, 1)}>Next →</button>
            </div>
            <div className="timeline-strip">
              {person.timeline.map((t, i) => (
                <div className="tl-item" key={i}><b className="tnum">{t.year}</b><span>{t.event}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
