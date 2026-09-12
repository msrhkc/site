# Yarding — Changelog

This file is updated with every delivery from here forward: what was reported, what was actually wrong, and what changed. Newest entries at the top.

---

## Delivery — Full consistency audit, with data preservation proven

**Reported:** check the whole script, make it bulletproof, free of bugs and inconsistencies, without corrupting any previous data.

### Data preservation — proven, not assumed
The most important question was whether upgrading loses anything. This is now a permanent test rather than a claim: real records are created on the **actual shipped v465 file**, then the same database and stored settings are reopened with the current build and compared. Verified intact: every invoice, invoice line, payment, party, ship, ledger transaction and ledger line; invoice numbers unchanged (nothing is renumbered); cash balance identical; books balanced; every screen renders; and legacy records remain editable afterwards. Tables added since v465 appear empty rather than missing, and with no staff accounts the old shared staff code still works — so upgrading cannot lock anyone out.

Backup/restore was checked the same way: amendments, staff accounts, comments and on-record remarks all survive a full export/import round-trip, and a restored staff account can still sign in.

### Inconsistency found and fixed
Deleting a record removed it from its own screen but **not from anywhere else it was listed**. A deleted party was still selectable on the invoice and payment forms; a deleted ship still appeared in the invoice ship picker, the item form's ship picker, per-ship profit, and the ship Excel export. Nothing was corrupted, but staff could keep picking records that were supposed to be gone.

Fixed at the root: every listing now goes through shared `activeParties()`, `activeShips()` and `activeItems()` helpers instead of each screen filtering for itself — the pattern that let four places drift apart. Records already attached to an existing invoice are unaffected, so historical documents never lose the name they were issued under.

### Also verified clean (no bugs found)
A deleted invoice disappears from the P&L, sales-by-customer, sales-by-item, the sales statement, AR aging and receivables — not just its own list. An edited invoice is counted exactly once everywhere. Amendments always carry a reason, an actor and a timestamp. Two staff members sharing the same code get different stored hashes and cannot authorise each other's changes, and an admin's code does not authorise a staff member's.

**Tests:** 684 passing (up from 646), stable across three consecutive runs, layout audit clean.

---

## Delivery — Collapsing label column on detail screens

**Reported:** a screenshot showing "Recorded by" rendered as a vertical stack of single letters on the invoice detail screen.

**What was wrong:** in the key/value rows (Invoice Date, Terms, Recorded by, ID), the label column had no minimum width. When the value beside it was long and couldn't break — an invoice's long ID is one unbroken run — the browser gave that value the space and squeezed the label down to a single character per line.

**What changed:** label cells now hold their natural width on one line, and the value beside them wraps instead. Applies to every key/value detail row — invoices, payments and parties — not just the one in the screenshot. A permanent check was added to the layout audit so this pattern can't quietly return.

---

## Delivery — Ship information was being lost on spreadsheet import

**Reported:** ship info isn't imported when importing sales or expenses.

**What was actually wrong:** the importer only ever *matched* a ship name against ships that already existed. If no match was found, the link was silently discarded — no warning, no row flagged, nothing in the preview to notice. Parties and items were created automatically when missing; ships alone were not. So any imported work referencing a ship the app didn't already know about lost that link entirely, and per-ship profit missed all of it.

**What changed:**
- **Ships are now created on import when missing**, exactly like parties and items. Covered by the same "create anything that doesn't exist yet" checkbox, whose label now says so.
- **Forgiving name matching.** The same vessel gets written many ways — "MV Ocean Star", "M.V. OCEAN STAR", "mv ocean-star". Matching now ignores case, punctuation and vessel prefixes (MV/MT/SS), so an existing ship is recognised rather than a near-duplicate being created beside it. Verified: three different spellings of one ship across two files all resolve to the same record, and only genuinely new vessels get created.
- **Ships are visible in the preview before anything is committed** — a Ship column per row, plus counts of how many matched existing records and how many will be created (named). A blank cell leaves the invoice unlinked rather than guessing.
- **A warning if a ship column is selected but every row in it is blank**, which usually means the wrong column was picked.
- **Wider ship column aliases** — "Vessel", "Vessel Name", "Ship Name", "Lot", "Plot", "Boat", "Vsl" all match automatically.
- **A blank Ships template** added alongside the existing ones.

Verified across both the sales and expenses import paths, with per-ship profit correctly picking up imported sales and costs afterwards.

**Tests:** 646 passing (up from 629), stable across three consecutive runs, layout audit clean.

---

## Delivery — Staff accounts, code-confirmed edits everywhere, hidden code fields, editable print templates

**Reported:** (1) staff and admin must be able to edit and delete any record, confirming with a reason **and** their security code, recorded in Amendments plus a note on the entry itself; (2) code fields hidden everywhere with a properly aligned show/hide toggle; (3) print templates editable from Settings without touching code, allowing HTML/CSS/JS; (4) admin can add as many staff as needed (or none), staff sign in with an ID number and security code, and with no admin a staff member adds their own.

### Per-person staff accounts
Each staff member is now a real account with their **own ID number and own security code**, instead of everyone sharing one code. Admin adds them in Settings → Staff accounts (name + code; the ID number is assigned automatically and can be overridden). Duplicate ID numbers are refused. Codes are stored hashed — never in plain text. Removing someone stops them signing in but leaves everything they recorded intact and still credited to them.

**Backward compatibility mattered here:** a yard with no staff accounts keeps working exactly as before on the shared staff code. The ID-number login only appears once at least one account exists — otherwise this update would have locked every existing staff member out of their own books.

**Why this matters beyond convenience:** it's what makes "who recorded this" and "who amended this" actually mean something, and it's what the edit confirmation below checks against.

### Edit and delete on everything, confirmed by security code
Invoices, parties, ships, items and staff accounts can all now be edited and deleted by anyone, and each action requires:
- a **reason** (goes to the Amendments log),
- an optional **note left on the record itself**, timestamped and attributed, so anyone opening the entry sees why it looks the way it does without digging through Amendments,
- and **the person's own security code** — an admin's admin code, or a staff member's own. A staff code will not authorise an admin's change and vice versa. Without this, anyone on an unlocked device could amend records under someone else's name, which would make the whole log worthless.

Notes accumulate rather than overwrite, so a record amended three times shows all three.

### Code fields hidden everywhere
Every security-code and password field in the app — setup, login, access codes, staff accounts, app lock, AI key, and the new edit confirmations — is masked by default with a show/hide eye toggle. Built as one shared component so the behaviour and alignment are identical everywhere rather than re-implemented per form. The toggle sits inside the field and the input reserves matching padding, so it never overlaps the typed digits at any width.

### Fully editable print templates
Settings → **Design your own invoice layout**. Write your own HTML, CSS and JavaScript, using `{{tokens}}` for real values. Includes the full token list (clickable to insert), a repeating `{{#lines}}…{{/lines}}` block for line items, a **live preview against a real invoice**, and a "start from the standard layout" button so nobody faces a blank box.

Two deliberate safety properties: every substituted value is escaped, so a party name containing markup can't break or hijack a printed document; and a template that fails falls back to the built-in layout with a warning, because a broken template must never make printing impossible. The preview does not run your JavaScript — it renders inline in the app, and a half-finished script shouldn't be able to interfere with the page you're editing on.

### Bugs found and fixed
1. **Custom template line items printed blank.** The general token pass ran before the repeating line block was expanded, so `{{description}}` and friends inside the block found no matching top-level token and were emptied. Caught in testing; the passes are now correctly ordered.
2. **The staff login change removed an element the app still relied on**, breaking the role label on the login screen.

**Tests:** 629 passing (up from 586), stable across three consecutive runs, layout audit clean.

---

## Delivery — Onboarding, searchable help, AI connect, and full staff autonomy

**Reported:** onboarding/familiarisation for everyone plus a note when an update ships; a searchable help modal in Settings; an optional "connect your AI"; and giving staff as much autonomy as possible — all the features and settings an admin gets. Plus a fresh check for bugs.

### Staff autonomy
Staff now get **everything an admin gets**: the Ledger, the Amendments log, the full Settings page, every import, backup and restore, voiding, manual journal entries, editing bank accounts, and clearing device data.

**One deliberate exception: changing the login codes stays admin-only.** If anyone could change the admin code, a single mistake could lock the entire yard out of its own books with no way back in. Staff see that section with the reason written out, rather than it silently missing — so it reads as a decision, not a bug. Everything else is open; say the word if you want the codes opened too.

### Onboarding and update notes
- A **six-step familiarisation tour** on first login for *everyone*, not just admins — what each screen is for, that mistakes can be fixed freely, that they can keep using their own spreadsheets, and where to find help. Skippable, and replayable any time from Settings.
- A short **"what's new"** note shown once per person after an update. Brand-new people don't get it — a change list for something you've never used is just noise.
- `window.APP_VERSION` controls this. Bump it and update `WHATS_NEW.items` whenever you ship something worth telling people about.

### Searchable help
19 topics covering the whole app, searched across titles, keywords **and** body text — so "refund" finds the advances topic even though that word isn't in its title. Replaces the previous single scrolling page, which couldn't be searched.

### Connect your AI (optional)
Bring-your-own-key, works with Anthropic, OpenAI, or any OpenAI-compatible endpoint. Ask questions about your own figures in plain language.

**On privacy, deliberately:** the key is stored only on the device, and only **aggregates** are sent — totals, balances, party names, top items — never the raw ledger. The consent card says exactly this before you connect. "Which buyer owes the most?" shouldn't quietly ship every transaction you have to a third party. Leave it off and everything else works unchanged.

### Bugs found and fixed
1. **Onboarding could steal a modal the person already had open.** The post-login prompt fires on a short delay, and in that window someone can easily have opened a form — it would have replaced their work mid-task. Caught in testing when it wiped out a confirmation dialog. It now stands down if anything is open.
2. **The onboarding module's own buttons would have failed in a real browser.** It was declared with `const` instead of the app's `window.X` convention, so inline `onclick` handlers referencing it couldn't resolve it. Caught only because the test harness reaches modules the same way the DOM does.
3. Two bugs in the new tests themselves (a `localStorage` reference that silently did nothing, so two checks were passing vacuously).

### Adversarial hunt on the new surfaces (no further bugs found)
Verified: hostile HTML in help search, in any AI field, and in imported spreadsheet cells never executes; the API key is never rendered back into the page; edits with NaN amounts are rejected; two consecutive edits leave the correct total rather than an accumulated one; editing a voided or deleted invoice is refused; deleting twice doesn't subtract twice; six degenerate import files (empty, blank rows, negative, 1e308, unrecognisable columns) are all handled; and every screen renders for a staff user now that access is widened.

**Tests:** 585 passing (up from 552), stable across four consecutive runs, layout audit clean.

---

## Delivery — Spreadsheet intake, edit/delete with an amendment log, blank templates, and a serious void bug fixed

**Reported:** (1) keep a log of the last working version; (2) staff keep records in whatever spreadsheet format they like and need a way to feed that in without changing how they work, including old files; (3) no edit or delete is hurting workflow — allow both for everyone, but require a reason and keep a separate log for admins; (4) provide downloadable blank templates.

### A serious accounting bug found and fixed along the way
While building the edit feature I found that **voiding an invoice subtracted its amount from income twice.** Voiding a ৳1,000 sale left income at **-1,000** instead of 0, and the P&L reported negative income that never existed. The cause: voiding both marked the transaction voided *and* posted a reversing entry, but every balance function in the app already excludes voided transactions — so the amount came off twice. The trial balance still reported "balanced" (both sides moved together), which is why it went unnoticed. Verified against the shipped v465 build, not theorised. **Any yard that voided invoices was under-reporting income; this release corrects those figures automatically, with nothing to re-enter.**

### Version log
`docs/VERSIONS.md` now records each verified-good build, with a snapshot kept in `versions/`. A version is only listed once the full suite passes with zero failures, the layout audit is clean, and the file parses. Rolling back is just using the older file — there's no build step and data lives separately.

### Edit and delete, for everyone, with accountability
- **Both are now available to all staff, not just admins** — but never silently. Every edit and deletion requires a typed reason.
- **Editing an invoice keeps the books correct.** The original ledger entries are reversed and replaced with corrected ones. The invoice number doesn't change (so anything already handed to a customer still matches), and any payments already recorded against it are preserved untouched.
- **Deleting never destroys anything.** The ledger is corrected the same way a void does and the record is hidden from lists, but it stays fully intact and reviewable.
- **New admin-only Amendments screen** listing every edit and deletion, who made it, when, their stated reason, and the complete before/after. It can't itself be edited or deleted.

### Flexible spreadsheet intake
The point is that staff *don't* have to change how they work. The importer reads any CSV or Excel file, in any layout:
- **Skips junk title and blank rows** above the real header, which real-world sheets almost always have.
- **Auto-matches columns** against a wide vocabulary of what people actually write — "Dt", "Party Name", "Particulars", "Wt (MT)", "Unit Price", "Total Value" all match correctly, in any order.
- **Handles messy dates** — dd/mm/yyyy, ISO, and raw Excel serial numbers. Anything genuinely unreadable is flagged for attention rather than silently guessed, since a wrongly-guessed date lands in the wrong reporting period and is very hard to spot later.
- **Fills in what's missing** — derives Amount from qty × rate, or Rate from amount ÷ qty.
- **Creates unknown parties and items** as it goes, without duplicating ones that appear on several rows.
- **Full preview before anything is written**, including a count of what will be created and a list of rows that need attention.

### Blank templates
Downloadable from Settings for Sales, Purchases, Expenses, Payments, Parties and Items. Each has one filled-in example row showing the expected shape — and that example row is **automatically skipped on import**, so forgetting to delete it can't create a phantom record. A filled-in template imports with every column matched automatically and no manual mapping.

**Tests:** 516 passing (up from 465), stable across four consecutive runs, layout audit clean.

---

## Delivery — Deliberate bug hunt: five real defects found and fixed

**Reported:** A request to test the app thoroughly and fix anything found.

**Method:** Rather than only re-running the existing suite (which passed), I wrote throwaway audit scripts that deliberately attacked the app from angles nothing had tested before: every view on a completely empty yard, every view against deliberately orphaned/malformed records, the accounting engine with invalid amounts, imports with corrupted files, hostile HTML in every text field, extreme numbers and dates, and every form opened and submitted blank. Five genuine defects surfaced. All are now fixed and locked in as permanent regression tests (the suite grew from 451 to 465 checks).

**Bugs found and fixed:**
1. **NaN amounts permanently corrupted the books.** A payment or advance of `NaN` passed the ledger's balance check (because `NaN - NaN` is `NaN`, and `Math.round(NaN) !== 0` is `true`) and wrote `NaN` into the ledger, poisoning every balance derived from it thereafter — with no error and no way to notice until totals started rendering as "NaN". `Ledger.post()`, the single chokepoint every money movement passes through, now rejects any non-finite amount outright.
2. **Negative ledger amounts were accepted.** These balance arithmetically while being meaningless in double-entry. Now rejected at the same chokepoint. (Reversals are, and always were, posted as real opposite-side entries — never negative amounts — so nothing legitimate is affected.)
3. **Advances could be applied or refunded far beyond what a party actually held**, driving the balance deeply negative (testing produced a balance of -99,799), which then displayed as a phantom balance everywhere. Both operations now validate against the real held balance.
4. **Zero and negative advance/payment amounts were silently recorded.** Now rejected.
5. **A corrupted backup file crashed the import outright.** If any table in the file was something other than an array (a string, a number — possible from a hand-edited or partially-written file), the import threw immediately. All import paths now run untrusted tables through a shared `asRows()` guard.

**Also hardened:** every UI call site that can now legitimately be rejected by the engine catches that rejection and shows a clear message instead of failing silently. The split-payment path specifically reports how many legs actually saved before a failure, rather than claiming success for all of them.

**Verified clean (no bugs found):** hostile HTML stored in any text field never executes; every view renders on a fully empty yard and against orphaned records; extreme values (999,999 × 999,999 and sub-cent amounts) and extreme dates (1900, 2999) keep the books balanced; every form opens and handles blank submission without creating anything.

---

## Delivery — Found the REAL cause of the blank Dashboard (the last fix wasn't it)

**Reported:** "still the same" — the previous fix (dead catch blocks in the IndexedDB helpers) didn't actually resolve the blank, stuck Dashboard.

**What was actually wrong:** The real cause was one level deeper. `IDB.open()` had no timeout and no handling for IndexedDB's `onblocked` event at all. If any other connection to an older version of the database is still open — most commonly another browser tab still holding this app open — a version-bumped `indexedDB.open()` call doesn't error and doesn't reject, it just sits there **forever**, waiting for that other connection to close. Nothing throws, so the previous fix (which only caught *thrown* errors) couldn't help — this was a genuine hang, not a crash, and the app just looked stuck loading with no error anywhere.

**What changed:**
- `IDB.open()` now has a hard timeout — if it hasn't settled within 4 seconds, it fails cleanly instead of hanging indefinitely. Combined with last delivery's fix (every IndexedDB helper now correctly treats a failed `open()` as "fall back gracefully"), this means the app will render — with local data if available, or in a degraded-but-visible state if not — rather than freezing on a blank screen.
- That failure is also now shared across all the tables loaded at startup, instead of each one independently re-attempting and re-waiting through its own timeout — so a blocked connection costs a few seconds once, not a compounding delay per table.
- Directly tested by simulating an actual permanently-blocked connection and confirming the app recovers within the timeout, and that a second call afterward fails immediately rather than waiting again.

If this happens again, it's very likely caused by having Yarding open in more than one tab at once — closing the other tab(s) and reloading should resolve it immediately, and now it'll no longer hang indefinitely even if that's not it.

---

## Delivery — Critical fix: found and fixed the cause of a blank, stuck Dashboard

**Reported:** "everything's broken now" — the Dashboard loading with just the header visible and a permanently empty body, no error shown anywhere.

**What was actually wrong:** A real bug in every one of the app's IndexedDB helper functions (`get`, `getAll`, `put`, `putAll`, `clearStore`). Each had a `try/catch` that looked like it would catch a failure — but because the code did `return new Promise(...)` instead of `return await new Promise(...)`, a rejection from inside that promise (for example, `getAll` on a table that doesn't exist yet) never actually reached the `catch` block — it escaped past it entirely. The two new comment tables added recently meant a device could hit exactly that gap while loading data at startup, which could crash the whole startup sequence with no error shown at all, leaving the header rendered but the content area permanently empty.

**What changed:**
- Fixed all five affected IndexedDB helpers — a one-word fix (`await`) each, but the root cause of the crash.
- Added two more layers of defense on top of that root-cause fix, since a bug like this deserves more than a single point of protection: the startup data-loading sequence now treats each table independently (one bad table can't take down the rest, matching how the cloud-sync path already worked), and — this is the big one — **if a screen ever fails to render for any reason, known or not yet discovered, the person now sees an actual error message and a button back to Dashboard, never a silent blank page again.** That last piece is what would have made this specific bug immediately diagnosable from the first report, instead of just "everything's broken" with no further information.
- All three fixes are directly tested, including a test that reproduces the exact original failure mode (calling into a nonexistent table) to confirm it now fails safely instead of crashing.

---

## Delivery — Invoice & payment redesign (lists, tabs, and a new payment detail view)

**Reported:** Screenshots of a standard accounting app's Invoice list, Invoice detail (Details/Payments/Comments tabs, status badge, Balance Due, More Information), Payments Received list, and Payment Receipt detail, with a request to follow that workflow — kept specific to ship dismantling (Yarding's own terms and data, not renamed to match the reference).

**What changed:**
- **Sales/Purchases/Expenses lists** are now filterable card lists (All / Unpaid / Overdue) instead of a single wide table, with each card showing the party, date, invoice number, total, balance due, and — for anything overdue — "OVERDUE BY N DAYS" in red, matching the reference.
- **Invoice detail** is now a tabbed view: **Details** (invoice date, the linked party's payment terms, due date, "More Information" showing who recorded it, the item breakdown, subtotal/tax/total/payment made/balance due), **Payments** (every payment actually applied to this invoice), and **Comments** — new, same attributed-note pattern as the recent party detail work. Status badge (PAID/OVERDUE/UNPAID/VOID) and Balance Due are shown prominently at the top. Print, Void (admin), and Record Payment actions all still work from here.
- **Payments list** is now a filterable card list (All / Received / Paid out).
- **Payment detail is an entirely new view** — Yarding had no way to see a single payment's own detail page before this, only the list. Shows amount, date, account, the specific invoice it was applied to (with a link straight to that invoice), and who recorded it. Void still works from here too.
- New `invoice_comments` table, alongside the `party_comments` table added last time (schema + IndexedDB migration, additive and safe).

---

## Delivery — Party detail redesign (Details / Transactions / Comments)

**Reported:** A set of screenshots of a standard accounting app's Customer detail screen (a summary bar, Details/Transactions/Comments tabs, contact quick-actions, collapsible info sections) and its New Customer form, with a request to match that design. "Party" stays as the term throughout — not renamed to "Customer."

**What changed:**
- **Parties could not be edited at all before this** — only created. Fixed: `Forms.partyForm` now supports both, pre-filling every field when editing.
- Added a **Payment Terms** field per party (Due on Receipt / Net 15/30/45/60), matching the reference form. New parties default to Due on Receipt.
- The party form is reorganized into "Party Information" and "Other Details" sections, matching the reference layout.
- Replaced the old plain "Statement" modal with a genuine tabbed **party detail view**: **Details** (contact info with tappable Call/Email, Receivables & Payables, Payment Terms), **Transactions** (every invoice with a real PAID/OVERDUE/UNPAID status and a type filter), and **Comments** — a new feature entirely, letting anyone leave a timestamped, attributed note on a party's record.
- New `party_comments` table (schema + IndexedDB migration, both additive and safe on existing data).

---

## Delivery — Banking Overview redesign, and a real fix for a silent state bug

**Reported:** A screenshot of a standard accounting app's Banking Overview (account/period filters, a prominent total, a collapsible trend chart, an active-accounts list) with a request to build something similar.

**What changed:**
- Banking now has an Account filter (All Accounts or one specific account) and a Period filter (last 7/30/90 days, this month, this year), a prominent total scoped to whatever's selected, and a "Banking Summary" trend chart with a Hide/Show toggle — all matching the reference layout. The trend chart now supports an arbitrary date range and can be scoped to a single account (previously it was always a fixed "all accounts, last 30 days" view on the dashboard only).
- Active Accounts below it is the same account-cards list as before, unchanged.
- **Found and fixed a real, previously-undetected bug while building and testing this**: the app's view-rendering dispatch called each screen's render function in a way that didn't actually bind `this` to `Views`, so any screen that read its own filter/toggle state via `this._something` was silently reading nothing — the state was being *set* correctly but never *read* back. This meant Reports' "Apply" date-range button has likely never actually changed what was displayed, this whole time, and it was never caught because nothing tested it. Fixed at the root (one line in the dispatcher), which fixes every affected screen at once, not just the new Banking one — and added a regression test for the Reports date range specifically, since that's the one confirmed to have been silently broken.

---

## Delivery — Dashboard redesign to match a reference screenshot

**Reported:** A screenshot of a standard accounting app's Dashboard (receivables/payables, overdue counts, a cash flow chart with a year-to-date summary, income vs expense, top expenses breakdown) with a request to build something similar.

**What changed:** Added to the existing Dashboard (which already had cash/receivables/payables KPIs, quick actions, a 30-day cash trend, and a sales-vs-expenses chart):
- **Overdue Invoices** and **Overdue Bills** count cards, tappable through to the Sales/Purchases list.
- A year-to-date cash summary under the existing 30-day cash trend chart — opening cash, incoming, outgoing, and the resulting closing cash, mirroring the reference layout.
- A new **Top Expenses** section — a segmented bar plus a percentage-and-amount breakdown per category, using a new `Charts.stackedBarSVG` (distinct from the donut chart already used in Reports, so the dashboard visually matches what was shown).

---

## Delivery — Full report menu (Financial, Sales, Receivables, Expenses, Payables)

**Reported:** A screenshot of a standard accounting app's Reports menu, with a request for all those report types.

**What changed:** The Reports page is now organized into the same categories shown — Financial Reports, Sales, Receivables, Expenses, Payables, plus Banking for the existing account statement. Added: Cash Flow Statement, Sales by Customer, Sales by Item, Sales by Sales Person, Customer Balance Summary, Vendor Balance Summary, Expenses by Category (as a proper table, alongside the existing chart), Payments Received, Payments Made, and itemized AR/AP Aging Details (the existing Aging Summary stays too). Every new report has its own Print and Export-to-Excel, built on one shared, consistent table-printing format so they all look and behave the same way rather than each being formatted separately. Balance Sheet, Profit & Loss, Trial Balance, and AR/AP Aging Summary already existed and are unchanged, just regrouped under the matching category headers.

---

## Delivery — One-off lines need a real item name, not just a bare description

**Reported:** Selecting "one-off" on an invoice line showed only a "Description" field — no place for an actual item name.

**What changed:** A one-off line now shows a required "Item name" field (exactly like picking or adding a real item does), with "Description" now a separate, always-available, optional field for any extra detail on top of it — whichever of the three ways named the line (one-off, an existing item, or a newly-added one). If extra detail is given, the two combine as "Name — detail"; if not, the description is just the name, same as before. Existing tests that filled in the old single field were updated to match.

---

## Delivery — Fixed a real mobile layout bug, corrected the sales statement style

**Reported:** A screenshot showing the Qty/Unit/Rate/Category row on a sale line crammed into unreadably narrow boxes on a phone, with "Category" wrapping onto two lines and overlapping. Also: the sales statement should be in the same bank-style debit/credit format as the account statement — not styled like a POS receipt, which was a misreading of the earlier request.

**What was actually wrong:** The previous delivery's line-item row used an inline `style="grid-template-columns:..."` to fit six fields in one row. An inline style always wins over a class's media query, so the row's fixed six-column layout could never actually respond to screen width — on a narrow phone it just uniformly shrank every column instead of wrapping, which is exactly what the screenshot shows. The same inline-override pattern existed on the tax row, the split-payment row, and the manual journal-entry row too — all four are now fixed.

**What changed:**
- Every multi-field editable row (invoice lines, tax rows, split-payment rows, journal-entry rows) now uses a flex-wrap layout with a sensible minimum width per field, instead of a fixed grid. Fields naturally reflow onto as many rows as the actual screen width allows — this isn't tied to one specific breakpoint, so it holds up "regardless of the screen," as asked.
- The now-unused fixed-grid CSS class was removed entirely, and a permanent check was added to the layout-audit script confirming that exact pattern can't quietly reappear.
- The sales statement now uses the same formal, ruled bank-statement style as the account statement — Date / Invoice # / Party / Debit / Credit / Balance, with a running total — instead of the narrow POS-receipt look from the previous delivery. Also added an Excel export for it, matching the account statement.

---

## Delivery — New reports, headless-yard settings, sales line redesign, minor fixes

**Reported (a batch of smaller items):**
1. New sale lines should default to "Scrap Sales," not "Other Income."
2. Staff should be able to add a brand-new item right from a sale/purchase line, with it becoming reusable for future sales — plus a unit field (kg/MT/piece/unit/item/Other) alongside qty and rate.
3. An "import module" shortcut on the admin Dashboard.
4. A folder-backup picker, matching the one shown from an earlier, separate app.
5. Staff need to set company logo/name/currency when the yard is headless (no admin) — but Settings should stay fully off-limits to staff whenever an admin actually exists.
6. The default seeded bank account should just be called "Bank Account," not "Main Bank Account," and staff on a headless yard should be able to rename it.
7. More reporting: a daily income/expenses breakdown, a bank-statement-style debit/credit report with daily/weekly/monthly/yearly presets and full itemized detail, a sales statement in the same visual style as the company's POS receipts, and a general pass for layout consistency (no overlapping or cut-off elements anywhere).

**What changed:**
- Sale lines now default their category to Scrap Sales.
- The item field on an invoice line is now a real picker (existing items, or "+ Add new item…"), and whatever's typed there becomes a genuine, reusable `items` record — not just text on one invoice. Each line also has its own unit, with "Other" revealing a field to specify anything not on the list.
- Admin's Dashboard now has a one-tap "Import a module package" shortcut, not just buried in Settings.
- A new `isHeadlessYard()` check (no admin account exists at all) lets a *reduced* Settings page through to staff — company name, logo, currency, and the folder-backup picker only. The full Settings page, and Settings for staff on any yard that actually has an admin, are unaffected.
- Bank account editing (renaming an existing account, not just adding new ones) is now available to staff specifically on a headless yard.
- The default seeded bank account is now named "Bank Account."
- New in Reports: a daily income/expenses table (print + Excel export), a fully itemized account statement with Daily/Weekly/Monthly/Yearly/Custom period presets, opening/closing balance and running balance per transaction (print + Excel export), and a sales statement styled to match the company's own POS receipts (narrow, monospace, dashed rules) rather than the formal ledger-style print used elsewhere.

---

## Delivery — Collision-proof invoice numbering, with a readable per-staff number

**Reported:** Multiple staff work asynchronously and offline, each creating invoices independently, with admin importing everyone's work later. Invoice numbers were generated per-device from a local count, so two staff working offline could — and eventually would — both produce the same number (e.g. both generating `SI-0001`), with no way to tell the resulting records apart once merged.

**What changed — every invoice now gets two identifiers:**
- **A long ID, the one thing the app actually relies on to tell records apart:** `SI-YYMMDD-HHMMSS-{staff initials}-{4-char random}`, generated the moment an invoice is created, with no shared counter and no coordination between devices required. This mirrors the mechanism already proven in the company's POS tool (reviewed directly from its source) — a real, second-precision timestamp plus a random tail is exactly what that system already uses to solve this same problem.
- **A short, friendly number, the one people actually read or write down:** `SI-{staff initials}{customer initials}-{6-digit sequence}` (e.g. `SI-MRMR-000001`) — a running count of that specific staff member's invoices of that kind, with the customer's initials riding along so two different staff's numbers don't look identical. This is never used to distinguish records internally, only to be legible.
- If two different staff happen to reduce to the same two-letter initials, it's quietly logged for admin to notice, rather than silently producing look-alike numbers with no record of it.
- **A one-time migration** brings existing invoices (created before this scheme existed) up to the new format, reassigning real long IDs and correctly sequenced friendly numbers, walked through in true chronological order per staff member. It's driven entirely by checking the actual data each time (does anything still lack a long ID), not a one-shot flag — **a real bug I caught in my own first version**: a flag-based "already migrated, never check again" design would have permanently missed re-migrating an old backup imported later, since a brand-new empty yard marks itself "done" immediately (correctly, since there's nothing to do yet) and a flag has no way to know that changed. Checking live data instead is self-healing regardless of when old-format invoices show up.
- Importing a file whose invoice number collides with an existing (genuinely different) invoice is now flagged clearly, showing both records side by side, rather than silently picking one.
- Added `invoices.long_id` to the schema (migration included, safe to re-run).

---

## Delivery — Prepaid/advance balances surfaced in Sales and Payments

**Reported:** Applying a customer's prepaid balance required going into their party profile first — it should show up right when recording a sale or a payment for them instead.

**What changed:**
- The invoice form now checks the selected party's prepaid balance automatically the moment they're picked (no profile visit needed) and offers to apply some or all of it toward the invoice being created — alongside, not instead of, a normal split payment, so "part advance, part cash" works in one step.
- The standalone "Record payment" form does the same when an outstanding invoice is selected: if that party has a prepaid balance, a banner offers a one-click "Apply prepaid balance" action.
- **Real bug found and fixed while building this** (the same class of issue as the payments/void bug from the previous delivery): voiding an invoice that had a prepaid balance applied to it correctly reversed the ledger entry, but left the underlying advance record marked as still "applied" — permanently under-reporting that party's real available balance afterward. Voiding an invoice now also restores any advance applied to it.

---

## Delivery — Split payments, staff bank accounts

**Reported:** Clients often pay one invoice through multiple methods at once (e.g. part cash, part two different banks), or pay partially now and the rest later — there was no way to represent that. Also, adding a bank/cash account was admin-only, which was too restrictive for staff who needed to set one up on their end.

**What was wrong:** "Paid now" on an invoice was strictly all-or-nothing, tied to exactly one bank account. The standalone "Record payment" form had the same one-account, one-amount limitation.

**What changed:**
- Both the invoice form and the standalone payment form now support multiple payment rows (account + amount each), addable via "+ Add payment method."
- Invoice creation and payment recording were unified onto one code path (`Ledger.recordPayment`), so partial payment, full payment, and split payment all work the same way whether it happens at invoice creation or later.
- Payments belonging to one split event share a `split_group_id` and are marked with a "split" badge wherever payments are listed.
- **Real bug found and fixed in the process:** voiding an invoice that already had payments recorded against it left those payment records active and the invoice's paid total stale. Voiding now also voids every payment tied to that invoice and resets the paid amount to zero.
- Staff can now add bank/cash accounts (editing and archiving existing ones stays admin-only).
- Added `payments.split_group_id` to the schema (migration included, safe to re-run).

---

## Delivery — Supabase AI setup instructions

**Reported:** Wanted a copy-pasteable prompt for Supabase's built-in AI assistant to run the full database setup automatically.

**What changed:** Produced a single, self-contained SQL script (combining fresh-install schema with every migration to date, all idempotent — safe to run on a brand-new project or an existing one) with an instruction wrapper telling the assistant to execute it directly.

---

## Delivery — Removed a stray "rupee" reference

**Reported:** No Indian references should appear anywhere in the app.

**What was wrong:** One line of helper text on the Ship form said "...keeps every rupee traceable to one invoice" — a leftover idiom, not an actual currency assumption anywhere in the code.

**What changed:** Reworded to "keeps every amount traceable to one invoice." Searched the whole file for any other India-specific terms (₹, INR, rupee, lakh, crore, GST, city names) — nothing else found. The app has no hardcoded currency; it always uses whatever symbol is set in Setup.

---

## Delivery — Optional, multi-line, percentage/per-unit tax

**Reported:** Tax should be an optional checkbox, support adding multiple taxes via a "+" button, and each tax should be selectable as a percentage or a per-unit amount.

**What changed:**
- Replaced the old single flat "Tax amount" field with an "Add tax" checkbox (off by default) and dynamic tax rows.
- Each row: a label, a type (percent of subtotal / flat amount per unit sold), and a value.
- The ledger still posts one "Tax Payable" line for the total — the breakdown is for the user's own records and shows on the invoice detail view and the printed invoice.
- Added `invoices.tax_breakdown` (jsonb) to the schema.

---

## Delivery — Staff/admin login redesign, staff-only setups, universal backup access

**Reported (across a few related messages):** Login should ask "Admin or Staff?" explicitly up front. Once a device/person has logged in before, it shouldn't keep asking. A yard set up as staff-only (no admin at all) shouldn't ask the question either, since there's only one possible answer. Also: export/import reportedly "not working."

**What was actually wrong (found by testing with real `.click()` calls instead of calling functions directly, which is what had been hiding this):** A plain view navigation (`UI.navigate`) queues a browser `popstate` event, exactly like a real back-button press does — and that event can arrive *after* a modal has opened. The modal-close listener had no way to tell a stale, leftover navigation event apart from a genuine back press, so it was silently closing brand-new modals (including every import screen, since those all live behind a navigation to Settings) moments after they opened. Fixed by tracking how many of these to expect and ignore.

**Also found:** in a staff-only yard (no admin account), Settings — and therefore every backup/import feature that lived only inside it — was completely unreachable to *everyone*, meaning nobody could ever back up their own data.

**What changed:**
- Login now asks "Admin" or "Staff" explicitly, before the code.
- The code is checked against the role actually chosen, not guessed from whichever one matches.
- A device that's logged in before skips straight to the code box for its last-used role.
- A staff-only yard skips the role question entirely, first login onward.
- "Back up everything (JSON)" is now reachable by everyone from the More menu, regardless of role or Settings access. Restoring a backup still requires Admin, and that's stated plainly next to the button.
- Fixed the popstate/navigation bug described above, and stress-tested it with rapid, realistic click sequences to confirm it holds up.

---

## Delivery — "Scrap Items" → "Items," button styling, Banking as a first-class section

**Reported:** The Items label said "Scrap Items" for no reason. Several buttons (the Advances & Prepayments actions) looked like plain clickable text instead of real buttons. Bank/cash accounts were buried inside Settings, but banking is core, everyday functionality.

**What changed:**
- Renamed "Scrap Items" to "Items" everywhere (nav, forms, exports).
- Rebuilt the Advances & Prepayments section into proper bordered cards with real, consistently spaced buttons.
- Added Banking as its own item in the sidebar/More menu, with a KPI, a card per account, and a real transaction register per account (with export) — moved out of Settings entirely.

---

## Delivery — User identity & attribution, import safeguards

**Reported:** This is a multi-person shared-code app; every entry should be traceable to a real person, not just "admin" or "staff." Only admins should be able to import; everyone should be able to export. Imports should preview their effect and ask for confirmation before committing, and should identify who supplied a file if it isn't already identified.

**What changed:**
- Login now asks for a name after the access code (remembered per role as a convenience default), and that name is stamped onto new records (`created_by`) instead of just the role.
- Exports (full backup, module packages) now carry the exporter's name.
- Import entry points are admin-gated at the function level, not just by page access.
- JSON restore, module-package import, and Excel/CSV master-data import all show a preview (what's new, what already matches, and where it will show up in the app) before anything commits.
- An import with no identified exporter requires naming who supplied it before it can proceed.
- A dedicated Activity Log in Settings now actually records logins, voids, connection changes, and device resets.

---

## Delivery — Mobile navigation and UI consistency pass

**Reported:** Several UI inconsistencies — icons stacking above text instead of sitting inline, a misaligned checkbox, a clipped "Dashboard" label in the bottom nav, no close button on modals, hardware/gesture back closing the wrong thing (or nothing).

**What was actually wrong:** A single CSS rule (`svg{display:block}`) with no override on the shared `.icon` class caused any inline `icon + text` pattern outside a flex container to stack vertically instead of sitting side by side — this was the root cause of several unrelated-looking "broken" spots at once, not separate bugs. Similarly, a checkbox was inheriting full-width text-input styling meant for `.field input` generally.

**What changed:**
- Fixed the icon-display bug at its root (one CSS rule), which resolved every instance of it app-wide, not just the reported one.
— Introduced a standard `.check-row` pattern for checkboxes so this class of bug can't recur.
- Added a persistent close (X) button to the modal system.
- Wired real back-button/gesture support into the modal and navigation system (later found to have a deeper timing bug — see the delivery above).
- Fixed the bottom nav's clipped label by giving it real overflow handling instead of a fixed font size with zero breathing room.

---

## Earlier deliveries (foundation)

The initial builds established: the core double-entry accounting engine (Ledger), Supabase + local-only dual-mode operation with automatic offline queueing, the full chart of accounts and seed data, invoices/purchases/expenses/payments/advances, ships and per-ship profit tracking, JSON/Excel backup and restore, module-package exports for segmented workflows, a folder auto-backup option, and the automated test suite (`smoketest.js` for functional correctness, `uicheck.js` for layout regressions) that every subsequent delivery has been checked against.
