import { DiyaIcon } from "./HeritageIntro";

// Weekly, monthly, ~100 days, yearly — a reasonable spread of moments worth
// celebrating without making every single day feel like a letdown by
// comparison.
const MILESTONES = [7, 30, 100, 365];

// Redesign v2 — a promoted card (title + description + CTA) rather than the
// original small pill, per the reference mockup. onContinue is optional so
// the pill-in-a-row usage elsewhere can still render without a click target.
export default function FamilyFlame({ streak, onContinue }) {
  if (!streak) return null;
  const isMilestone = MILESTONES.includes(streak);
  return (
    <div className={`family-flame${isMilestone ? " milestone" : ""} cover-enter`} style={{ "--enter-delay": "0.08s" }}>
      <div className="family-flame-text">
        <span className="eyebrow">{streak}-day family flame</span>
        <p>
          {isMilestone
            ? "The flame hasn't gone out — a real milestone, kept alive by everyone who's added something."
            : "Keep the flame of togetherness burning. Add a time, a story, or a memory."}
        </p>
        {onContinue && <button type="button" className="family-flame-cta" onClick={onContinue}>Continue flame →</button>}
      </div>
      <span className="family-flame-icon"><DiyaIcon /></span>
    </div>
  );
}
