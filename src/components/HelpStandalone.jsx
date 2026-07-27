import HelpView from "./HelpView";

// Help needs to be reachable from the login page too (no family data is
// loaded there yet), so it gets this small self-contained shell instead of
// the normal TopBar/BottomBar app frame, which assumes a real family.
export default function HelpStandalone({ onBack }) {
  return (
    <div className="login-page login-page-scroll">
      <button className="login-help-link login-back-link" onClick={onBack}>← Back</button>
      <div className="login-help-wrap">
        <HelpView />
      </div>
    </div>
  );
}
