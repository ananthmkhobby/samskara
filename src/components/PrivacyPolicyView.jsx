const SUBPROCESSORS = [
  { name: "Supabase", use: "Database (family/person/contribution records), authentication, and file storage (photos, audio, video, documents). Data is encrypted in transit and at rest." },
  { name: "Vercel", use: "Hosts the web app itself. Vercel does not have access to your family's stored data — the app talks to Supabase directly from your device." },
  { name: "OpenAI", use: "Powers optional AI features: drafting a biography chapter from spoken interview answers, translating text, and extracting names/dates from an uploaded family-tree photo. Only the specific content submitted to these features is sent, for that single request." },
  { name: "OpenStreetMap (Nominatim)", use: "Converts a city/place name you enter into map coordinates for the Journey map. Only the place name is sent." },
];

export default function PrivacyPolicyView() {
  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Privacy Policy</h2>
        <p>How Samskara collects, uses, stores, and protects your family's information.</p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Who this covers</h4>
        <p className="folio-summary">
          This policy explains how Samskara ("we", "us", "the app") handles information when a family uses it to
          build and maintain their archive — the tree, Folios, photos, voice recordings, videos, documents,
          memories, traditions (Parampara), family library, and anything else contributed through the app.
        </p>
        <p className="folio-summary" style={{ marginTop: 10 }}>
          Contact for any privacy question or request: <b>support@samskara.com</b>
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>What we collect</h4>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>Account information.</b> Your email address, a display name, and your role within the family (Member,
          Admin, or Family Head).
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>Family content you or your family contribute.</b> Names, birth/death dates (or year-only where the
          exact date isn't known), relationships, rashi/gotra, current city, places lived, photographs, audio
          recordings, videos, written memories, life lessons, biography chapters, Parampara entries, and Chitrashale
          room contributions. If you use the voice-guided interview, your spoken answers are transcribed and used to
          draft written text for your review before it's saved.
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>Information about people who aren't app users.</b> A family tree necessarily includes people who never
          created an account — deceased ancestors, and often children or other relatives. This is entered by an
          adult family member on their behalf. If you believe information about you was added without appropriate
          consent, contact us and we'll address it.
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>Technical information.</b> Sign-in timestamps, device/browser type, and basic error logs — not used
          for advertising or behavioral tracking.
        </p>
        <p className="folio-summary">
          <b>Location data.</b> A "current city" or place lived is sent to a third-party geocoding service
          (OpenStreetMap/Nominatim) to place it on the Journey map. Only the place name is sent.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Children's data</h4>
        <p className="folio-summary">
          Family trees often include children. Samskara is not directed at children and does not knowingly allow
          anyone under 18 to create or administer their own account. Information about minors is entered and
          controlled by an adult family member, who is responsible for having the right to include it. Under
          India's DPDP Act, processing a child's personal data requires verifiable parental/guardian consent —
          adding a minor's information to your family's tree confirms you have that authority, or that a
          parent/guardian has consented.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Who can see your family's data</h4>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          <b>Every family's data is isolated from every other family</b>, enforced at the database level — not
          just a UI restriction. A member of one family cannot be shown another family's people, photos, or
          contributions.
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          Within your own family, members can generally view the shared archive. Only Family Heads and Admins can
          approve or reject contributed content, promote members, or manage invites. A Member's new or edited
          content is marked <b>Pending</b> and sits in a review queue — visible to Admins/the Family Head, with a
          record of who submitted it — until approved as <b>Verified</b>.
        </p>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          We do not access your family's content except to provide support you've requested, investigate a
          reported abuse/security issue, or where required by law. We do not read, sell, or share your family's
          content with advertisers or data brokers.
        </p>
        <p className="folio-summary">
          The public demo (a "try it now" link, no login) shows a separate, fictional sample family. It contains no
          real family's data, and nothing entered while browsing it is saved to any real family's archive.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 14 }}>Where your data is stored</h4>
        {SUBPROCESSORS.map((p) => (
          <div key={p.name} style={{ marginBottom: 12 }}>
            <div className="tag-row" style={{ marginBottom: 6 }}>
              <span className="tag" style={{ fontWeight: 700 }}>{p.name}</span>
            </div>
            <p className="folio-summary">{p.use}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>How long we keep your data</h4>
        <p className="folio-summary">
          Your family's archive is kept for as long as your family account remains active. If a Family Head or
          Admin requests deletion (see below), we delete the family's data from active systems within a reasonable
          period, subject to any shorter retention in backups (which age out automatically) or a legal obligation
          to retain specific records longer.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Your rights</h4>
        <p className="folio-summary">
          Under the DPDP Act and how the app is designed, you can: <b>access</b> what's stored (Gallery, Vault,
          Review Queue, Roster all show this directly, or ask us); <b>correct</b> inaccurate information directly
          (Admins/Family Head) or by proposing an edit (Members, subject to review); <b>request deletion</b> of your
          account or your family's data; <b>withdraw consent</b> for a minor's data you previously added; and
          <b> ask who has access</b> to specific content — the app already shows a contributor/review-status
          trail for everything.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Deleting your account or your family's data</h4>
        <p className="folio-summary">
          Contact <b>support@samskara.com</b> with your family name and what you'd like deleted (your own account
          only, or the whole family's archive — the latter requires confirmation from a Family Head or Admin).
          We'll confirm the request and expected timeline before proceeding.
        </p>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Security &amp; changes to this policy</h4>
        <p className="folio-summary" style={{ marginBottom: 8 }}>
          We rely on our infrastructure providers' security certifications (Supabase and Vercel are both SOC 2 Type
          II certified) plus our own access controls: database-enforced per-family isolation, role-based approval
          for content changes, and encrypted storage for all media. We will notify affected families without undue
          delay if we become aware of a breach affecting their data, as required under applicable law.
        </p>
        <p className="folio-summary">
          If we make a material change to this policy, we'll update it and, where significant, notify Family
          Heads/Admins directly before it takes effect. Questions: <b>support@samskara.com</b>
        </p>
      </div>
    </section>
  );
}
