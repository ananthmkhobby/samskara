const ROLE_ROWS = [
  {
    role: "Family Head",
    who: "The account created when the family is first set up (via the internal provisioning page, not an invite) — exactly one per family.",
    can: "Everything an Admin can, plus the only one who can delete a person from the tree.",
  },
  {
    role: "Admin",
    who: "Promoted by the Family Head — open the Admin page and scroll to \"Family roster,\" where the Head can turn any Member into an Admin (or step one back down) with one click.",
    can: "Approve or reject anything in the review queue, edit any field immediately (no review needed), generate invite links.",
  },
  {
    role: "Member",
    who: "Anyone who joins with an invite link.",
    can: "Add memories, photos, dates, and new family members — everything goes to the review queue for an Admin to verify first.",
  },
];

export default function HelpView() {
  return (
    <section className="wrap">
      <div className="section-head">
        <h2>Help &amp; getting started</h2>
        <p>How a family tree starts, who's in charge of it, and what each role can do.</p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>How a tree starts</h4>
        <p className="folio-summary">
          A family tree isn't self-serve — it's set up once, for one family, by whoever's provisioning the archive
          (that's the Family Head). From there, the Head or an Admin generates an invite link from the Admin page
          and shares it with relatives. Anyone who opens that link creates an account and joins as a Member. There's
          no way to "start your own tree" from a blank login — every family begins with that first invite.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Belonging to more than one family</h4>
        <p className="folio-summary">
          Since every person is really part of two family lines — their mother's and their father's — one login can
          belong to more than one tree at once (say, both a mom's-side and a dad's-side family). The two admins don't
          need to coordinate at all: each one just generates their own invite link as usual, from their own family's
          Admin page.
        </p>
        <p className="folio-summary" style={{ marginTop: 10 }}>
          If you're already signed in and open a second family's invite link, it's added straight away — no second
          account, no re-typing a password. From there, the family name next to your role badge in the top bar is a
          switcher: click it to see every family you belong to and jump between them, or to join another one with a
          code. Each family's data stays completely separate — switching never mixes them together, it just changes
          which tree you're looking at.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 14 }}>Roles &amp; privileges</h4>
        {ROLE_ROWS.map((r) => (
          <div key={r.role} style={{ marginBottom: 16 }}>
            <div className="tag-row" style={{ marginBottom: 6 }}>
              <span className="tag" style={{ fontWeight: 700 }}>{r.role}</span>
            </div>
            <p className="folio-summary" style={{ marginBottom: 4 }}><b>Who becomes this:</b> {r.who}</p>
            <p className="folio-summary"><b>Can do:</b> {r.can}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Adding what you know</h4>
        <p className="folio-summary">
          Open anyone's folio and use "Share what you know" to add a memory, photo, audio, video, document, or an
          important date. Members' contributions land in the Admin review queue as <b>Pending</b> until an Admin
          approves them; Admins and the Family Head see their own changes go live immediately.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Parampara — your family's heritage</h4>
        <p className="folio-summary">
          A family-level section (its own tab, not tied to one person) for the things that survived because of your
          family — traditions, your kula devata's story, veda lineage, family slokas, how festivals were celebrated
          across generations, family dharma, ancestor wisdom, skills that are fading, and living memories worth
          keeping. Anyone can add an entry; it goes through the same review queue as everything else before it's
          visible. A daily-rotating quote from it is featured on the Cover page too.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Family Library</h4>
        <p className="folio-summary">
          A shared bookshelf, also family-level. Each book has its own journey — who owned it, who it was gifted to,
          who's read it — plus tabs for its story, who's currently reading it, lessons it taught the family, personal
          memories tied to that copy, and an ongoing discussion thread. New books go through review like anything
          else; marking yourself as a reader or adding a link to a book's journey is instant, no approval needed.
          If a book's last owner has passed away, it becomes a locked "Grandfather's Shelf" — a quiet memorial nobody
          edits or rearranges.
        </p>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>The review queue</h4>
        <p className="folio-summary">
          Everything submitted by a Member — new memories, proposed edits, new family members — waits in the Admin
          page's review queue for a second pair of eyes. An Admin or the Family Head approves or rejects each item
          there before it changes anyone's folio.
        </p>
      </div>
    </section>
  );
}
