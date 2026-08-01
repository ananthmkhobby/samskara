export default function TermsOfServiceView() {
  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Terms &amp; Conditions</h2>
        <p>The terms you agree to by using Samskara.</p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Acceptance of these terms</h4>
        <p className="folio-summary">
          By creating an account, accepting a family invite, or using the public demo of Samskara ("the app", "the
          service"), you agree to these Terms &amp; Conditions and to our Privacy Policy. If you do not agree,
          please don't use the service.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Who can use Samskara</h4>
        <p className="folio-summary">
          You must be at least 18 years old to create or administer a family account. The app is designed for
          families to document their own history; it is not directed at children as independent users. Information
          about minors may appear within a family's tree, but only as entered and managed by an adult family
          member — see the Privacy Policy for how that works.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Accounts, invites, and roles</h4>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          Families join Samskara through an invite created by an existing Family Head or Admin, or by starting a
          new family archive directly. Every family member has one of three roles: <b>Member</b>, <b>Admin</b>, or
          <b> Family Head</b>. Admins and the Family Head can approve or reject content submitted by Members, manage
          the family roster, and generate invites. Members can view the shared archive and propose content, which is
          reviewed before it becomes part of the permanent record.
        </p>
        <p className="folio-summary">
          You're responsible for keeping your own login credentials confidential and for any activity under your
          account. Tell us immediately if you suspect unauthorized access. We may suspend or terminate an account
          we reasonably believe is being used to violate these terms, harass another user, or compromise the
          security of the service.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Your content</h4>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>You own what you contribute.</b> Photos, recordings, memories, and other content you add remain yours
          (or your family's).
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>The license you grant us</b> is limited to what's needed to run the service: storing, processing, and
          displaying your content back to your family (including generating AI-assisted drafts, thumbnails, or map
          placements from content you submit). We do not license your family's content to third parties, use it for
          advertising, or claim ownership of it.
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>You're responsible for what you upload</b> — don't upload content you don't have the right to share,
          or content that's unlawful, defamatory, or violates another person's privacy or rights. Review by an
          Admin/Family Head doesn't transfer legal responsibility away from the person who submitted it.
        </p>
        <p className="folio-summary">
          <b>Removal.</b> A Family Head or Admin can reject or remove content from the shared archive at any time.
          If you believe something about you was added without appropriate consent, contact us and we'll help
          resolve it.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>AI-assisted features</h4>
        <p className="folio-summary">
          Some features (the voice-guided interview → biography draft, translation, and photo-to-tree scanning) send
          the specific content you submit to a third-party AI provider (OpenAI) to generate a draft. These drafts
          are suggestions for you to review, edit, or discard — nothing an AI feature produces is saved to your
          family's archive until you (or, for Members, an Admin/Family Head via the review queue) approve it.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>The public demo</h4>
        <p className="folio-summary">
          A "try it now" link may let visitors explore a sample family with no login required. The demo family is
          fictional sample data — nothing you do in the demo is saved permanently, and no real family's information
          is ever shown there.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Service availability &amp; liability</h4>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          We aim to keep Samskara available and your family's archive intact, but don't guarantee uninterrupted
          access. We recommend keeping your own copies of particularly important photos or recordings outside the
          app too, the same way you would with any digital service.
        </p>
        <p className="folio-summary">
          To the maximum extent permitted by applicable law, Samskara and its operators are not liable for
          indirect, incidental, or consequential damages arising from your use of the service. Nothing here limits
          liability where it cannot lawfully be limited (for example, gross negligence or willful misconduct).
        </p>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Changes, governing law &amp; contact</h4>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          We may update these terms or the service over time; where a change is significant, we'll notify Family
          Heads/Admins before it takes effect.
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          These terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of
          the courts of [CITY], India.
        </p>
        <p className="folio-summary">
          Questions about these terms: <b>support@samskara.com</b>
        </p>
      </div>
    </section>
  );
}
