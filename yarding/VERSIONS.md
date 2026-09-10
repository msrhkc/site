# Yarding — Known-Good Version Log

Every delivery from here forward records the last version that was verified working, so there is always a known-good state to fall back to rather than discovering too late that things have degraded.

**A version is only listed here if, at the moment it was snapshotted:**
- the full smoketest suite passed with **zero** failures,
- the layout audit (`uicheck.js`) reported no issues,
- the file parsed cleanly (`node --check`),
- and the div open/close counts matched.

Snapshots live in `/home/claude/msr-finance/versions/`.

## How to roll back

The app is a single self-contained HTML file, so rolling back is just using the older file — there is no build step, no dependencies, and no migration to undo. Data is stored separately (IndexedDB or Supabase), so an older app version reads existing data fine.

**The one thing to check before rolling back:** if a newer version added a database table or column and you roll back past it, the older code simply won't know about that data — it stays on disk untouched, it just isn't shown. Rolling forward again restores visibility. Nothing is lost by rolling back; the schema changes are all additive.

---

## Versions

### v570 — 2026-09-09 — current known good
- **File:** `versions/yarding-v570-known-good.html`
- **Tests:** 570 passing, 0 failing (stable across 3 consecutive runs)
- **Layout audit:** clean
- **Added:** onboarding tour for everyone on first login; "what's new" note after an update; searchable Help; optional Connect-your-AI; staff now have the same access as admins apart from the login codes.
- **Fixed:** `createInvoice` wrote the invoice and its lines *before* posting to the ledger, so a rejected posting left an orphaned invoice — a record showing a total in every list and report with no ledger entries behind it. Also fixed: the onboarding prompt could replace a modal the person already had open, and the Onboarding module was declared in a way its own buttons couldn't reach in a real browser.

### v516 — 2026-09-09 — superseded
- **File:** `versions/yarding-v516-known-good.html`
- **Tests:** 516 passing, 0 failing (stable across 4 consecutive runs)
- **Layout audit:** clean
- **Added:** edit + delete for everyone with mandatory reasons and an admin-only amendment log; flexible spreadsheet intake (any layout, auto-matched columns, full preview); downloadable blank templates.
- **Fixed:** a serious accounting bug present in v465 — voiding an invoice subtracted its amount from income **twice**, so a voided 1,000 sale left income at -1,000 and the P&L reported income that never existed. Any yard that voided invoices on v465 had understated income; upgrading corrects the figures automatically, with no re-entry needed, because the underlying entries were always intact.
- **Note on rolling back:** rolling back to v465 reintroduces that void bug. Prefer rolling forward.

### v465 — 2026-09-09 — superseded (has a known accounting bug)
- **File:** `versions/yarding-v465-known-good.html`
- **Tests:** 465 passing, 0 failing
- **Known bug:** voiding an invoice double-subtracts from income and distorts the P&L (fixed in v516). Kept only as a reference point — **not recommended for use.**
