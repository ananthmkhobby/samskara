import TermsOfServiceView from "./TermsOfServiceView";

// Reachable from the login page too (no family data loaded yet), so it gets
// this small self-contained shell instead of the normal TopBar/BottomBar app
// frame — same pattern as HelpStandalone.
export default function TermsOfServiceStandalone({ onBack }) {
  return (
    <div className="login-page login-page-scroll">
      <button className="login-help-link login-back-link" onClick={onBack}>← Back</button>
      <div className="login-help-wrap">
        <TermsOfServiceView />
      </div>
    </div>
  );
}
