import { DiyaIcon } from "./HeritageIntro";

// Weekly, monthly, ~100 days, yearly — a reasonable spread of moments worth
// celebrating without making every single day feel like a letdown by
// comparison.
const MILESTONES = [7, 30, 100, 365];

export default function FamilyFlame({ streak }) {
  if (!streak) return null;
  const isMilestone = MILESTONES.includes(streak);
  return (
    <div className={`family-flame${isMilestone ? " milestone" : ""} cover-enter`} style={{ "--enter-delay": "0.08s" }}>
      <span className="family-flame-icon"><DiyaIcon /></span>
      <div className="family-flame-text">
        <b>{streak}-day family flame</b>
        {isMilestone && <span className="family-flame-milestone-label">The flame hasn't gone out.</span>}
      </div>
    </div>
  );
}
