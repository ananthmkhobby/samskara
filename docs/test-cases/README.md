# Test cases

A living log of what's been manually verified, how, and when — the evidence
trail for the parts of the app that don't have automated tests yet (see the
gaps list in `docs/SDLC.md`). One file per feature area; append, don't
rewrite history.

## Entry format

```
### <date> — <what was tested>

**Change:** <PR / commit, one line>
**Steps:** <what was actually done>
**Result:** pass / fail — <what was observed>
**Environment:** dev (samskara-koaham.vercel.app) / production (oursamskara.com)
```

## Index

- [whatsapp.md](whatsapp.md) — WhatsApp contribution flow, privacy choice, profile-pic shortcut
- [exports.md](exports.md) — family photobook / biography / Vamshavali PDF generation
