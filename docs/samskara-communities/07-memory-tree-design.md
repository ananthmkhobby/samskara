# 07 — Memory Tree Design (Year → Event → Media)

The "memory tree" is not a hierarchy of people. Its data is **temporal and categorical**: years contain events, and events contain media. Drawing it as a literal node diagram would show three levels of boxes that carry almost no information. This document compares visualizations against what the pilot will actually hold.

## 1. Realistic data volume (pilot, year one)
- 1 community, about 10–20 events: Ganesh Chaturthi, Independence Day, Navratri/Dandiya, Diwali, Christmas, New Year, Sankranti/Pongal, Holi, sports day, AGM, plus a few ad-hoc ones
- 50–500 photos per big festival and 10–50 for small events; a few thousand items in total
- Events cluster heavily from August to November, the festival season

## 2. Options evaluated

| View | Strength | Weakness at pilot scale | Verdict |
|---|---|---|---|
| Node tree (year→event→photo) | Matches the word "tree" in the brief | Low information density, awkward on mobile, nothing to see but node labels | Rejected |
| Calendar (month grid) | Good for planning upcoming events | 10–20 events across 12 months leaves most cells empty; the autumn cluster crowds a few months | Secondary at most; deferred |
| Vertical timeline | Simple, scrolls well on mobile, shows that the archive is growing | With one year of data it is a short list, and covers are small | Secondary |
| **Yearbook grid** (year header → event cards with cover photos) | Photo-led, which suits what residents come for. Feels like a keepsake. Grows naturally year after year. | Weak for exact dates (solved by putting the date on each card) | **Primary** |

## 3. Recommendation
- **Primary: Yearbook.** A year selector (pill row, current year by default) sits above a 2-column (mobile) or 3–4 column (desktop) grid of event `.card`s. Each card shows the cover photo, the event name in `--font-display`, the date, the photo count, and optionally a festival glyph in `--font-devanagari` (for example गणेश). Gold accent is for festivals and forest green for civic or sports events, using existing tokens.
- **Secondary 1: Timeline.** A toggle on the same screen (reusing the `tree-mode-toggle` pattern) shows the same events as a dated list. It is useful for the committee and for "what happened in March". Build it by adapting the row layout from `ActivityView.jsx` or `JourneyMapView.jsx`; don't write a new component family.
- **Secondary 2: Upcoming strip** on Community Home. It shows the next 1–3 scheduled events as an agenda list, not a calendar grid. A full calendar is deferred until a community has more than about 40 events per year.
- **Explicitly not built for the MVP:** a calendar grid, a node tree, a map, or a "people tree" of contributors.

```mermaid
graph LR
  Y[Year pills: 2025 | 2026] --> G[Yearbook grid of event cards]
  G --> E[Event page]
  E --> GAL[Photo/video grid → PhotoLightbox]
  E --> H[Highlights strip]
  E --> P[Contributors and organizers]
  G -. toggle .-> T[Timeline list]
```

## 4. Event page contents
1. **Header:** cover photo, name, date or date range, location within the society (clubhouse, terrace), category, status (Upcoming / Live – accepting uploads / Archived).
2. **Highlights:** 6–12 photos curated by the committee, shown as a horizontal strip. These feed the community's "best of year" view.
3. **Organizers:** named committee members and volunteers. Names are shown only if those people opted in.
4. **Gallery:** all approved photos and videos, sorted by capture time, with a filter for "my uploads". Opens in the existing `PhotoLightbox.jsx`.
5. **Contributors:** a count and avatar row ("42 photos from 9 households"). An individual name appears only with that person's opt-in.
6. **Share and upload:** a primary "Add your photos" button while the event is Live. A "Get share link/QR" button for the committee. Per locked decision 1, there is no "send to residents" button: the committee posts the link in their own WhatsApp group.
7. **Notes/story** (optional): a short write-up, which later feeds Community History.
8. **Pending notice** (shown only to the uploader and committee): "3 of your photos are awaiting review (photos with children are reviewed first)."

## 5. Data notes
- Media belongs to exactly one event. The "Year" is derived from the event date and is not its own entity.
- Uncategorised uploads go to a per-year "Everyday moments" bucket event, so nothing is ever orphaned.
- Child-containing media carries `visibility = review_only` until approved. Grids and counts exclude it for everyone except the uploader and the committee.
