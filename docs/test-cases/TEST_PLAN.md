# Full feature test plan — test & production parity verification

Run once against each environment with a disposable test family, cleaned up
after. Results logged in `RESULTS.md` in this folder. A few features
(real audio/video capture, camera photo-scan, native "Add to Home Screen")
can't be driven by browser automation — these are marked **Code-verified**
and cross-referenced to the feature's implementation instead of claimed as
UI-tested.

| # | Area | Case | Method |
|---|---|---|---|
| 1 | Onboarding | Sign up, create a new family as Head | UI |
| 2 | Admin | Set family name, tagline, logo | UI |
| 3 | Admin | Generate invite link | UI |
| 4 | Invite | Redeem invite link as a new Member | UI |
| 5 | Tree building | Add person one at a time (son/daughter/spouse/parent) | UI |
| 6 | Tree building | Spreadsheet bulk import + review screen | UI |
| 7 | Folio | Edit a person's detail (name/date/heritage field) | UI |
| 8 | Folio | Share what you know — Memory (text) | UI |
| 9 | Folio | Share what you know — Photo | UI |
| 10 | Folio | Share what you know — Document | UI |
| 11 | Folio | Share what you know — Important date | UI |
| 12 | Folio | Audio / Video recording | Code-verified (no mic/camera in headless browser) |
| 13 | Folio | AI-guided voice interview opens and drafts | UI (text-based follow-up path) |
| 14 | Folio | Full biography view + Download PDF | UI |
| 15 | Folio | Anubhava Chitrashale renders | UI |
| 16 | Parampara | Add a tradition/entry | UI |
| 17 | Parampara | Vamshavali view + download | UI |
| 18 | Library | Add a book, mark ownership | UI |
| 19 | Treasury | Life lessons list + value filter | UI |
| 20 | Japa | Log a practice count | UI |
| 21 | Dates Vault | Timeline renders recorded dates | UI |
| 22 | Journey | Map renders with pins | UI |
| 23 | Gallery | Verified photos wall | UI |
| 24 | Search | Find a person by name | UI |
| 25 | Admin | Review queue — approve a Member's pending submission | UI |
| 26 | Admin | Roster — reset a member's password | UI |
| 27 | Admin | Duplicate Photos tool renders | UI |
| 28 | Admin | Gallery export code generation | UI |
| 29 | Tree | Download family photobook (PDF) | UI |
| 30 | WhatsApp | Webhook: new-number link flow | API (simulated Twilio POST) |
| 31 | WhatsApp | Webhook: photo + privacy-choice flow | API (simulated Twilio POST) |
| 32 | Multi-family | One login, two families, switcher | UI |
| 33 | Auth | Username-based login (no-email account) | UI |
| 34 | Auth | Sign out / sign back in | UI |
| 35 | Legal | Privacy Policy & Terms pages render | UI |
| 36 | PWA | Manifest + service worker present | Code-verified (install gesture itself is a browser/OS action, not app code) |
| 37 | Security | Response headers (HSTS/CSP/X-Frame-Options) present | HTTP check |
| 38 | Cross-tenant | A Member of Family A cannot read Family B's data | API (direct query attempt) |

Cleanup: delete the disposable test family (cascades to all its data),
revoke/delete its Storage objects, remove any WhatsApp test connection.
