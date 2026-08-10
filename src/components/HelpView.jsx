import InstallAppCard from "./InstallAppCard";

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
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Curious first?</h4>
        <p className="folio-summary" style={{ marginBottom: 12 }}>
          See a full example family — five generations, verified stories, a shared family library — before you set
          up your own.
        </p>
        <button type="button" className="btn primary small" onClick={() => { window.location.href = "/?demo=1"; }}>
          Try a live demo →
        </button>
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

      <div style={{ marginBottom: 18 }}>
        <InstallAppCard />
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

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>What's new — seeing what the family has added</h4>
        <p className="folio-summary">
          The bell at the top of the screen opens <b>What's new</b>: everything the family has added
          lately, newest first, grouped by day. A number on the bell means there are things you
          haven't looked at yet; opening the page clears it. Tap any line to jump straight to that
          person's folio. Admins also see a reminder there of anything still waiting to be reviewed.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Anubhava Chitrashale — a person's room</h4>
        <p className="folio-summary">
          From anyone's folio you can step into <b>their room</b>: a small illustrated space the
          family furnishes with objects that carry a memory — a lamp, a tumbler, a pair of
          slippers. Each object stays quiet until it's tapped, then reveals a memory, a recorded
          voice, or simply a silence. On the way out you're asked one question: if someone had to
          remember them in a single sentence, what would you add?
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Japa &amp; Chanting counts</h4>
        <p className="folio-summary">
          Log mala rounds, Hanuman Chalisa, Vishnu Sahasranama, Gayatri Mantra — or any practice
          your family keeps — from the card on the Home screen or from More → Japa &amp; Chanting.
          You can log for yourself or on behalf of an elder who doesn't use the app. Counts apply
          straight away with no review, and you'll see both your own total and the whole family's.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Dates, and what to do when you don't know one</h4>
        <p className="folio-summary">
          Birthdays and anniversaries collect in the <b>Dates Vault</b>, and the nearest upcoming
          birthday is shown at the top of Home. If you only know a year, enter just the year —
          it'll be recorded honestly as a year rather than inventing a day. If you know someone has
          passed away but not when, open their folio, edit <b>Date of death</b> and tick
          "they've passed away, but no one knows exactly when." A living husband or wife of someone
          who has passed is quietly marked <b>Widowed</b> on their folio.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Fixing names and details</h4>
        <p className="folio-summary">
          Spelling mistakes happen, especially after a bulk import. Tap the small pencil beside
          anyone's name on their folio to correct it — their place in the tree and everything
          recorded about them stays exactly as it is. A Head or Admin can also correct the
          <b> family's own name</b> under Admin → Manage members, and rename a member in the roster.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Adding a whole family at once</h4>
        <p className="folio-summary">
          For a large family, don't add people one at a time. Download the spreadsheet template
          from the Family Builder, fill in one row per person offline, and upload it — the tree,
          the marriages and the generations are worked out for you. Photos and recordings are
          added afterwards inside the app. You can always add earlier generations later:
          open the oldest person's folio and add a parent above them, as many times as you need.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 20 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Your family's privacy</h4>
        <p className="folio-summary">
          Your family's archive is completely separate from every other family's — that separation
          is enforced by the database itself, not just hidden in the app. Photos and recordings are
          kept privately and opened through short-lived links, never public web addresses. You can
          read the full <b>Privacy Policy</b> and <b>Terms</b> from the sign-in screen. Keep your
          own copies of anything truly irreplaceable, as you would with any app.
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
