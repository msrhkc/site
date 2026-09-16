# MSR POS — Changelog

## 1.1.0 — 2026-09-10
- Printed/exported statements (admin "Print statement" and the cashier's daily
  gate-pass statement) now list every item on its own row with its own
  Category/Vessel/Description/Qty/Unit/Rate/Amount — previously all items on
  a receipt were joined into a single cell, losing structure.
- Each receipt's payment breakdown is now its own clearly labeled row
  (method, amount, reference), separate from the item rows.
- New **Yarding Export** button (Admin → Receipts tab): a CSV shaped to match
  Yarding's own "Import records from any spreadsheet → Sales" flow exactly —
  headers `Date, Customer, Item, Quantity, Unit, Rate, Amount, Ship, Notes`,
  one row per item (Yarding creates one invoice per row). POS receipt ID and
  payment details are carried in Notes, since Yarding's spreadsheet importer
  has no payment field — marking invoices paid in Yarding is still a manual
  step there.
- New **"Round totals" toggle** in Settings (off by default): rounds GRAND
  TOTAL figures up to the nearest whole Tk on receipts, gate passes, printed
  statements, WhatsApp summaries and the Grand Total column of every export.
  This is presentation-only — it never changes the stored total, and never
  touches the live payment-collection math during checkout (Step 3), so cash
  reconciliation is unaffected.
- Added version tracking and this changelog, with an in-app "What's new"
  panel (Settings → What's new), following the same pattern as Yarding.

## 1.0.0 — baseline
- Initial production release: cashier POS flow, admin receipts/exports
  (CSV/XLSX/JSON), printable receipts and gate passes, cashier daily history
  and statement.

## 1.2.0 — 2026-09-10
- New **Filer** role: read-only staff access to today's statement, XLSX and
  JSON exports — same full detail as admin, nothing before today, no sale
  entry, no editing, no cashier management, no CSV/Yarding export. Created
  from Admin → Cashiers → "Add a cashier or filer" (role dropdown), or by
  switching an existing profile's role via its Actions menu.
  **Requires a small backend change — see note below.**
- CSV, XLSX and JSON exports restructured so nothing is merged into a joined
  string: Items and Payments are now always separate tables (Export CSV
  downloads two files, Items and Payments, linked by Receipt ID), and every
  reimbursement detail field (bank, branch, account name/no, routing, cheque
  no, payee, PO no, handed-to) got its own column instead of being joined
  into one "Reference / Details" string.

### Backend change needed for the Filer role
This POS file only handles the client side. The actual admin/cashier
distinction is decided by the `verify-totp` Supabase Edge Function (not part
of this HTML file), which currently only ever returns `role: 'admin'` or
implicitly treats anything else as a cashier. For Filer to work:
1. Add a `role` column to the `cashiers` table (defaults to `'cashier'`):
   `ALTER TABLE cashiers ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'cashier';`
   (The POS already writes/reads this column — inserting a cashier now sends
   `role`, and the Cashiers list can switch a profile between Cashier/Filer.)
2. Update the `verify-totp` Edge Function so that when a code matches a row
   in `cashiers`, it includes that row's `role` in its JSON response (it
   already returns `name`/`phone`/`token`/`expiresAt` for a matched cashier —
   just add `role: matchedRow.role` to that same response). No other change
   needed there; the client already branches on `result.role === 'filer'`.

## 1.2.1 — 2026-09-10
- **Rounding fixed**: "Round totals" now rounds to the *nearest* whole Tk
  (.50 and above rounds up, under .50 rounds down) instead of always
  rounding up. Same scope as before — grand totals only, on receipts, gate
  passes, printed statements, exports; item and payment amounts are never
  touched.
- **Filer role now needs zero backend changes.** Reworked to not require the
  `cashiers.role` column or any Edge Function update after all, since months
  of production data already sits on the current schema. A cashier becomes
  a Filer purely by being added to a small list (`filer_roster`) stored
  under a new key in the existing `app_settings` table — the same
  general-purpose table already used for bank details and WhatsApp numbers.
  Nothing about `cashiers`, `verify-totp`, or any other existing table/
  function changes. Toggle it from Admin → Cashiers → per-person "Make
  filer" / "Make cashier", or at creation time via the role dropdown.

## 1.2.2 — 2026-09-10
- Yarding Export: the vessel/ship name is now also written into the Notes
  column on every item row, in addition to the Ship column. Reason (found in
  Yarding's own source, not changed here): Yarding's spreadsheet importer
  only links the Ship column to a Ship record that already exists there —
  unlike Party and Item, it does not auto-create a missing ship, so a vessel
  name with no matching Ship record in Yarding was silently dropped. Rather
  than modify Yarding, the POS export now also carries the vessel name in
  Notes as a plain-text backup, so it's never lost even before the ship is
  set up over there.

## 1.3.0 — 2026-09-10
- **Export XLSX rebuilt from scratch**: instead of separate Items/Payments
  sheets with receipt info repeated on every line, it's now one "Statement"
  sheet structured exactly like the printed statement — a Receipt row (ID,
  date, client, phone, cashier, grand total), then that receipt's Item rows,
  then its Payment rows, then a Reimbursement row if any, then a Total row.
  Every fact has its own column across 28 columns (Row Type, Receipt ID,
  Date, Client, Phone, Cashier, Item, Category, Vessel, Description, Qty,
  Unit, Rate, Amount, Payment Method/Amount/Fee/Reference, nine separate
  reimbursement detail columns, Grand Total) — nothing is ever joined into
  one cell. Item/Payment/Reimbursement/Total rows carry Excel's native
  outlineLevel, so they show up as real collapsible subrows under each
  receipt's banner row (the +/- grouping controls on the left in Excel).
  A blank cell means that column doesn't apply to that row type (e.g. an
  Item row has no Payment Method) — it is not missing data.
  Money figures (Rate, Amount, Payment Amount/Fee, Grand Total) are written
  as real numbers, not text, so Excel can sum/format them directly.
  Export CSV is unchanged (still two linked files, Items.csv + Payments.csv).

## 1.3.1 — 2026-09-10 (audit pass)
Full-file review. No database schema, table, or stored-record format was
changed; all existing Supabase and localStorage data is read exactly as
before. Fixes:
- **Printed statement was losing reimbursement data.** `buildStatementRows`
  never carried the `reimbursement` field, so `buildAdminStatementHtml` read
  `undefined` and (being null-guarded) silently printed nothing for it.
  Reimbursement details now appear on printed statements. The cashier who
  received each sale is now shown too.
- **Printed statement joined payments into one cell** ("payment+payment") —
  the same problem previously fixed for XLSX. Each payment now gets its own
  row (method / reference / fee / amount), plus a separate reimbursement
  row, matching the XLSX statement structure exactly.
- **"What's new" popped up over the login screen** before anyone signed in,
  and marked itself seen under an `unknown` key so the real cashier never
  saw it. Now only shows for a signed-in cashier, and fires on login as well
  as on reload.
- **Receipt list totals ignored the rounding toggle** in both the admin and
  Filer tables while every other total respected it. Now consistent.
- **Filer panel claimed it "resets automatically at midnight" but didn't.**
  Left open overnight it kept showing the previous day's rows under the
  previous day's date. A once-a-minute day-change watch now reloads it.
- **Filer "Print statement" had no empty guard** while its XLSX/JSON buttons
  did, so it could print a blank statement. Now consistent.

Verified: whole page executes in a headless DOM with zero uncaught errors;
every `getElementById` target exists in markup; no duplicate event-handler
assignments; all statement table rows total exactly 8 columns; XLSX sheet
writes exactly its 28 declared columns with matching widths and real Excel
row grouping; no localStorage key collisions with the history-prune loop
(it only ever touches `msr_local_history_*`).

## 1.3.2 — 2026-09-10 (audit pass, continued)
Second review pass over the sale-entry and money paths. Found one serious
pre-existing data-loss bug:
- **Unfinished sale drafts were destroyed on every page load and could
  never be resumed.** `renderItems()` ends by calling `saveDraft()`, and
  INIT calls `renderItems()` before `loadDraftIfAny()`. During that first
  render the in-memory sale is still empty, so `saveDraft()` took its
  "nothing to save" branch and deleted the stored draft — before anything
  had a chance to read it. The "resume this sale?" prompt therefore never
  appeared, and any sale interrupted by a refresh or accidental close was
  silently lost. Fixed by snapshotting the stored draft at load, before any
  render can run, and reading the resume prompt from that snapshot.
- **A draft could be destroyed by someone merely opening the login screen.**
  `loadDraftIfAny()` ran at INIT regardless of login state, so its blocking
  confirm appeared over the lock screen (and for filers, who cannot make
  sales at all) — and its Cancel branch discarded a cashier's unfinished
  work before that cashier had even signed in. Draft handling is now gated
  on an actual cashier session, runs on login as well as on reload, and
  `saveDraft()` will not clear a draft that hasn't yet been offered back to
  the person it belongs to.

Also verified this pass, no changes needed: all monetary values are integer
cents everywhere (`toCents` and item amounts both round), so the
fully-paid balance check is exact rather than approximate; fee calculation
is consistent between the payment screen, receipts, and the statement; and
draft restore correctly re-sources cashier identity from the live session
rather than the saved draft.

Regression re-run after these fixes: page executes with zero uncaught
errors, no missing element ids, no duplicate handler assignments, tag
balance intact, and draft resume verified across all four cases (not logged
in / logged in with draft / logged in without draft / resume declined).

## 1.4.0 — 2026-09-10
- **Yarding export is now a JSON module package, not a CSV.** It matches the
  shape Yarding's own `exportModulePackage()` produces and
  `doImportModulePackage()` consumes (Yarding → Settings → Import a module
  package). This carries what a spreadsheet never could: payments and
  double-entry ledger postings, so a POS sale lands in Yarding already
  marked **paid** with the books balanced, instead of as an unpaid invoice
  needing manual settlement.
  - Parties, ships, items, accounts and bank accounts are matched **by name**
    on import, so existing Yarding records are reused, not duplicated. The
    account/bank names used are exactly the ones Yarding seeds
    ('Accounts Receivable', 'Scrap Sales', 'Other Income', 'Cash in Hand',
    'Bank Account'), which matters because Yarding's bank-account import
    branch creates a fresh ledger account for any name it doesn't recognise.
  - Every id is **derived from the POS receipt id**, not random, so
    re-exporting and re-importing the same receipts adds nothing the second
    time.
  - QR/Card fees become their own invoice line; payments are recorded net of
    any change returned, so cash on hand is not overstated.
  - Export refuses to write the file at all if any ledger entry doesn't
    balance, rather than handing over something that would unbalance the
    yard's books.
  - Amounts are always exact here — the "round totals" setting is display
    only, and rounding a total but not its lines would post an unbalanced
    entry.
- **Payment QR can now be set from an image link** as well as an uploaded
  file. The stored record keeps its original `{ data_url }` shape and merely
  gains an optional `url`, so existing settings keep working untouched. An
  uploaded file takes priority over a link, and a link that fails to load
  falls back to the placeholder instead of showing a broken image.

## 1.4.1 — 2026-09-10
- **Filer Panel was completely broken after a page reload.** Restoring a
  filer session ran the panel's data load partway through script parsing,
  where the midnight-watcher state and the timezone constants were still in
  their temporal dead zone — it threw before rendering anything, leaving the
  panel permanently empty. This is what was behind "filer portal not showing
  daily transactions". The bootstrap is now deferred until parsing finishes.
- **Filer Panel now shows the whole day in full detail on screen** — every
  receipt with each item, quantity, rate and payment on its own line (the
  same statement Print produces) — instead of a summary table requiring each
  receipt to be opened individually.
- **Filer Panel now has the Yarding export** as well.
- **All dates and times are now yard time (Asia/Dhaka, UTC+6)**, regardless
  of the device's own clock: receipts, statements, exports, the cashier's
  daily history, the admin date filter and the Filer Panel's "today". Dhaka
  has no daylight saving and is a fixed +06:00, so this is exact rather than
  approximate. Verified byte-identical output with the device set to
  New York, Tokyo, Dhaka and UTC, including correct midnight rollover.
  **Stored data is unchanged** — `submitted_at` remains the same UTC instant
  it always was; only its display and which calendar day it counts under
  changed.

## 1.5.0 — 2026-09-13
- **Filer Panel showed no transactions — root cause found and fixed.** It was
  querying the `receipts` table directly via `sb.from('receipts').select()`.
  That table is RLS-protected and only readable with an authenticated
  Supabase session, which an **admin** has (verify-totp returns a real auth
  token) but a **filer does not** — a filer holds the same lightweight
  session token a cashier gets. The query therefore returned nothing, every
  time, with no error shown. The panel now calls the `get-today-history`
  Edge Function with its token, which is the anon-safe path cashiers already
  use. No backend change was required.
  - Added `normalizeFilerRow()` to bridge the cashier-facing record shape the
    Edge Function returns (`receiptId`/`submittedAt`/`cashier`/`client`/…)
    to the raw table-row shape the admin statement, XLSX and Yarding builders
    expect (`receipt_id`/`submitted_at`/`cashier_name`/`record`/…), so the
    filer reuses those builders rather than growing a second copy that could
    drift.
  - Real failures (missing token, bad response, network error) now say so
    instead of silently rendering "No receipts yet today".
  - If the server returns records without monetary fields, the panel says so
    explicitly rather than showing rows of blank amounts that would read as
    zero-value sales.
- **WhatsApp messages were losing data — now structured and complete**, in
  line with the printed statement:
  - Vehicle and driver details (plate, driver name, driver phone) are
    included; they were captured on the sale but appeared in no message.
  - Reimbursements now carry every detail field (bank, branch, account name
    and number, routing, cheque no., payee, PO no., handed-to). Previously
    only the amount and method were sent.
  - The statement message now lists each receipt's items (qty × rate =
    amount) and each payment line, instead of collapsing every sale to one
    "receipt — client — total" line and hard-truncating at 40 receipts. It
    fills a character budget on **whole** receipts and, if any remain, states
    how many and points to Print/XLSX, rather than cutting off mid-receipt.
  - The reimbursement-field helper is now defined once at top level and
    shared by the admin exports and the WhatsApp builders, so the two can no
    longer disagree about which fields are included.

## 1.5.1 — 2026-09-13
- **Filer Panel data load is now genuinely diagnostic.** The previous fix
  (1.5.0) assumed the `get-today-history` Edge Function would just work,
  based on how it's used elsewhere in this file — but on a real device it
  returned "Network error", and this client has no visibility into that
  function's server-side code or deployment status to know why. Rather
  than guess again, the failure message now shows the literal HTTP status
  and response body (or exception message) from the failed call, e.g.
  `get-today-history returned HTTP 404: Not Found` — enough for whoever
  manages the Supabase project to fix the actual cause immediately. A
  second, independent path (an anonymous Supabase Auth session + the same
  direct `receipts` table read the admin panel uses) is tried automatically
  if the first fails, in case that combination is already viable given the
  project's configuration.
  - **This still can't be fully resolved from this file alone.** Whether
    either path ultimately works depends on server-side configuration
    (Edge Function deployment/CORS, and/or the `receipts` table's Row Level
    Security policy plus whether anonymous sign-in is enabled) that isn't
    visible from the client. The exact diagnostic text the panel now shows
    is what's needed to fix it definitively — or share `get-today-history`'s
    source and the RLS policy on `receipts` directly.
- **Filer Panel now has full output parity with the admin Receipts tab**:
  Export CSV (Items + Payments) and Send Statement to Office/Owner on
  WhatsApp were missing and are now included, alongside Print statement,
  Export XLSX, Yarding Export, and Export JSON. Editing, deleting, and sale
  entry remain admin/cashier-only, by design — a filer is read-only over
  today's data, not a second admin account.

## 1.5.2 — 2026-09-13
- Confirmed diagnostic from a real device: `get-today-history request
  failed: Failed to fetch`. That specific browser wording means the request
  never reached a server at all and got no response of any kind — not a 404,
  not a 500, nothing. Since login (a *different* Edge Function, verify-totp)
  succeeds on the same device seconds earlier, this points very specifically
  at `get-today-history` itself: almost always a missing
  `Access-Control-Allow-Origin` response header (including on its `OPTIONS`
  preflight), or the function not being deployed at that URL at all — not a
  real connectivity problem, and not something any client-side retry can
  route around.
  - The panel's message now spells this out explicitly rather than leaving
    it as a raw error string.
  - The second (anonymous-session + direct table read) path's own specific
    failure reason is now captured and shown too — e.g. "anonymous sign-in
    rejected" or "returned zero rows (RLS is likely filtering them out)" —
    instead of failing silently, so a single screenshot now carries the
    complete picture from both attempts.

**This is the limit of what can be fixed from the client.** A CORS header
can only be added inside the Edge Function's own code, deployed via the
Supabase CLI or dashboard — nothing in this HTML file can add it from
outside. The standard fix, for whoever has access to edit and redeploy
`get-today-history`, is to add a CORS preflight response and headers on
every response, e.g. (Deno/Supabase Edge Function shape):

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
    Deno.serve(async (req) => {
      if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
      // ...existing logic...
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    });

If that function's source can be shared, the exact patch can be written
directly instead of this general guidance.

## 1.6.0 — 2026-09-13
- **Admin can now edit a receipt** — client name/phone, vehicle/driver,
  items (add/remove/edit each field, qty/rate live-recalculate the amount),
  payments (add/remove/edit method/amount/reference), and the reimbursement
  block. From Receipts → open a receipt's detail → **Edit receipt**.
  - A reason is **required** to save — the Save button opens a reason
    prompt; leaving it blank or cancelling saves nothing.
  - Validation before saving, mirroring the same rules the original sale
    entry form and Yarding's own invoice validation both use: every item
    needs a name, a quantity greater than zero, and a non-negative rate;
    every payment needs an amount greater than zero; the reimbursement (if
    ticked) needs an amount greater than zero.
  - Grand total is recomputed from the edited items and payments (subtotal +
    QR/Card fees) — never edited directly, so it can't drift from what the
    line items actually add up to.
  - The receipt is updated first, then the change is logged; if the log
    write itself fails, an alert says so explicitly (with the reason
    reproduced in it) rather than silently losing the record of what
    changed.
- **Deleting a receipt now also requires a reason.** Previously it was a
  bare confirm() with no record kept of why. The reason is logged (with the
  full receipt content preserved in the log) **before** the delete happens,
  since a delete can't be undone — if the log write fails, admin is asked
  to explicitly confirm deleting with no log, rather than that happening
  silently.
- **New Amendments tab**, mirroring Yarding's own Amendments log exactly:
  every edit and deletion, who made it, when, the reason given, and a "See
  what changed" button showing the complete before/after JSON. Filterable
  by All / Edits / Deletions. Nothing in this log can be edited or deleted
  by anyone — that's what makes it a log. The Filer role has no access to
  any of this (no edit, no delete, no Amendments tab) — read-only over
  today's data is unchanged.

### One-time Supabase setup required
This is a genuinely new capability and needs a new table. **Nothing
existing is altered** — no column is added to `receipts` or `cashiers`, no
existing row is touched, and this is safe to run alongside months of live
data. Run once, in the Supabase SQL editor:

    create table if not exists amendments (
      id uuid primary key default gen_random_uuid(),
      entity_type text not null,
      entity_id uuid,
      entity_label text,
      action text not null,
      reason text not null,
      before_json jsonb,
      after_json jsonb,
      created_at timestamptz default now(),
      created_by text
    );
    alter table amendments enable row level security;

    -- Match whatever policy already lets an authenticated admin session
    -- read/write the `receipts` table. If that policy is, e.g., "any
    -- authenticated user has full access", the equivalent here is:
    create policy "admin full access" on amendments
      for all
      to authenticated
      using (true)
      with check (true);

If the real policy on `receipts` is narrower than "any authenticated
user" (e.g. tied to one specific admin account), use that same condition
here instead of `using (true)` — whoever manages the project will recognize
the shape from how `receipts` is already locked down.

Also required: the `receipts` table needs `update` permitted for the
admin's authenticated session (the same session that already successfully
`delete`s from it) — if `update` isn't currently allowed by its RLS policy,
add it there too, since editing calls `sb.from('receipts').update(...)`.

## 1.6.1 — 2026-09-13 (confirmed working)
- Deployed `get-today-history` as a new Supabase Edge Function (source
  written to match `verify-totp`'s existing session mechanism exactly —
  validates the token against `cashier_sessions`, the same table
  `verify-totp` writes to on a cashier login, then returns receipts for the
  given date range). No existing function, table, or policy was touched to
  add it.
- **Confirmed live**: Filer accounts can now see the day's transactions in
  full detail, end to end, matching everything requested in this build.
- This is the version this handoff covers as the current, working state of
  the POS.

## 1.7.0 — 2026-09-13
### Gate passes — item detail properly structured
- **Every item field is now labelled** (`CATEGORY:` / `VESSEL:` /
  `DESCRIPTION:`) and styled distinctly from its value. Previously
  Category, Vessel and Description all shared one identical unlabelled
  style, and the description had no label at all — so a description
  reading e.g. "Engine Room" was visually indistinguishable from a vessel
  name on a printed pass.
- **Items are numbered**, so a pass can be read against a load in order.
- **New tally line** under the items: total line-item count plus total
  quantity summed per unit (e.g. "2 line items · Total quantity: 7.5 kg"),
  so a short-loaded or over-loaded truck is obvious against the pass at
  the gate.
- Prices remain absent from gate passes — verified by test that no
  currency figure can appear on one. A gate pass is a release
  authorisation, not a financial document.
- The same labelling was applied to receipts and the price-free broker
  copy, which had the identical ambiguity.

### Statements and exports — no field left out
Audited every field the record actually holds (`items`: name, category,
vessel, desc, qty, unit, rateCents, amountCents; `record`: client,
vehicle, cashier, payments, reimbursement, receiptId, submittedAt) against
what each output actually emitted. Three real gaps were found and fixed:
- **Vehicle and driver details appeared in no statement or export at all**
  — captured on every sale, shown nowhere. Now included in: the admin
  printed/on-screen statement, the cashier/filer price-free statement, the
  XLSX statement sheet (as `Vehicle Plate` / `Driver Name` /
  `Driver Phone` columns), and the CSV items export.
  `buildStatementRows()` was also silently dropping `vehicle` on the way
  through, so it's now carried like every other field.
- **Item description was missing entirely from the price-free statement**
  (cashier's daily / filer's "Today in full detail") — it showed Item,
  Category, Vessel, Qty, Unit but not Description. Added, and the table
  widened from 5 to 6 columns to match.
- The price-free statement now also shows the receiving cashier and the
  vehicle/driver line, matching the admin statement.

### Structural hardening (prevents this class of bug recurring)
- XLSX statement sheet column positions are now **derived by name** from
  the single `STATEMENT_SHEET_HEADERS` list (`SSC['Description']` etc.)
  instead of hard-coded numeric indexes. Previously, inserting a column
  would have silently shifted every subsequent write by one, putting data
  under the wrong headings — exactly the kind of silent corruption that is
  hard to spot in a spreadsheet.
- Column widths are likewise generated from the header list, so widths can
  no longer fall out of step with the columns.

### Verified
- Gate pass: all fields labelled, numbered, tally correct, zero prices.
- Admin statement: vehicle/driver/description/reimbursement all present;
  every row exactly 8 columns.
- CSV items (17 cols) and payments (19 cols): every row matches its header
  width exactly.
- XLSX statement: 31 headers, 31 widths, every row 31 wide, row-count
  equals outline-level count, every value under its correct heading.
- Full page regression: loads with zero errors, no missing or duplicate
  element IDs, tag balance intact, no undefined CSS variables.

### Data safety
No schema change, no stored-record format change, and no migration needed
for this release. Every change is additive on the presentation side —
existing receipts render with the new structure automatically, and records
that simply have no vehicle or description (older sales, walk-ins) render
cleanly with those lines omitted rather than showing empty labels.

## 1.7.1 — 2026-09-17
- **Payment QR is now built into the app** as a default, so the Bank/QR
  panel shows a scannable code with no configuration needed
  (`DEFAULT_BANK_QR_URL`).
- It is strictly a *fallback*, never an override: a QR an admin has
  uploaded or linked in Settings always wins. Verified across all six
  value shapes — link set, file uploaded, both set (upload wins), legacy
  record with an empty `data_url`, explicitly cleared, and no record at
  all — only the last three fall through to the built-in image.
- Applied at startup rather than only on settings load. `loadAppSettings`
  returns early when the backend client is unavailable, and never calls
  `applyBankQrImage` at all when no `bank_qr_image` row exists — so
  without an explicit startup call the default would never have been
  painted and the panel would have sat empty on exactly the setups that
  need the default most.
- Existing behaviour preserved: a QR image that fails to load (dead link,
  offline, host down) still falls back to the placeholder rather than
  showing a broken-image icon.
- No schema change, no migration, no stored-record change.

## 1.8.0 — 2026-09-17
### Payment QR — replaced and made properly scannable
- New QR image wired in as the built-in default.
- **The old presentation was marginal for scanning.** A QR needs three
  things the decorative placeholder wasn't providing, all now fixed:
  - **Solid white field.** It previously sat on the app's grey surface
    (`--surface-2`), reducing the dark-on-light contrast scanners rely on.
  - **Quiet zone.** The code sat flush against a 2px dashed border. The QR
    spec requires blank margin around the symbol; codes without it are
    frequently unreadable. The border is now dropped once a real code is
    present and 8px of white padding added.
  - **Size.** Raised from 140px to 190px, and **tapping the code now opens
    it full-screen** (up to 520px on a white card) so a customer can scan
    from across a counter. Closes on tap or Escape.
- Rendering uses `object-fit: contain` so modules stay square, and
  `image-rendering: -webkit-optimize-contrast` to keep module edges crisp
  rather than blurred.
- Unchanged: a QR configured in Settings (uploaded file or link) still
  overrides the built-in one, and a QR that fails to load still falls back
  to the placeholder rather than showing a broken image.

### Release notes are now admin-only
- Cashiers and filers no longer see release notes in any form — the link
  and version label are gone from their settings, and the notes no longer
  auto-open on login for them. **Reason:** the notes describe the admin
  panel, its tabs and its capabilities. Showing them on a shop-floor
  device would tell anyone holding a cashier code that an admin panel
  exists and roughly what it can do.
- They now open only from a **What's new** button inside the admin panel,
  and auto-show once per version on admin login. The "seen" marker is keyed
  to the admin rather than to a cashier name.
- **Two further leaks found and closed** while auditing what cashier- and
  filer-facing text actually says:
  - The filer panel described itself as showing "the same full detail as
    the admin exports" → now "full transaction detail for filing".
  - A filer-facing error said "Ask the admin about enabling amounts for
    filers" → now "Report this so it can be looked into".
  - A filer-facing diagnostic naming the Supabase project was also
    softened to "whoever set this system up".

### Bug scan
Full structural and runtime audit run after these changes:
- No JS reference to a non-existent element, no duplicate element IDs, no
  duplicate event-handler assignments, tag balance intact, no undefined
  CSS variables.
- Temporal-dead-zone scan (the recurring failure class in this build)
  found no genuine top-level use-before-declaration; the single flagged
  match is inside a function body, reached only at runtime.
- Confirmed all newly added markup appears before the script that
  references it, so nothing binds to a null element.
- Verified by simulated session: cashier and filer both load with zero
  errors, see no release notes, no version label, no admin panel, and no
  text mentioning an admin. Admin still auto-sees notes once per version,
  can reopen them from the button, and Receipts → detail → Edit →
  Amendments all work.

### Data safety
No schema change, no migration, no change to any stored record format.
All changes are presentation-side or access-scoping only; existing
receipts, settings and amendment entries are read exactly as before.
