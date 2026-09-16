# MSR POS — Handoff Document
**Version 1.8.0 — 2026-09-17**

This is the current, working state of the MSR Retail POS: a single-file
HTML app (`index.html`) backed by a Supabase project. This document is the
map for whoever picks this up next — what exists, what each piece depends
on, and what still needs action before it's fully live.

---

## 1. What's in this handoff

- **`index.html`** — the complete app. Open it in a browser, or host it
  anywhere static files are served. No build step, no dependencies to
  install — everything (XLSX/QR/PNG libraries, Supabase client) loads from
  CDN inside the file itself.
- **`CHANGELOG.md`** — full version history from 1.0.0 to 1.6.1, in detail.
- **`HANDOFF.md`** — this file.

---

## 2. Roles and how each one gets in

All three sign in from the same single 6-digit code field — there is no
separate "admin login" screen anywhere in the UI.

| Role | How it's identified | Session mechanism | What it can do |
|---|---|---|---|
| **Cashier** | Code matches a row in `cashiers` | `cashier_sessions` table (token, 12h expiry) | Enter sales, print/send receipts, see today's local history |
| **Filer** | Same as Cashier, but the matched name is also in `app_settings.filer_roster` (checked client-side after login) | Same `cashier_sessions` token | Read-only: today's transactions in full detail, Print/CSV/XLSX/JSON/Yarding exports, WhatsApp sends. No sale entry, no edit, no delete |
| **Admin** | Code matches a row in `admin_totp` | Real Supabase Auth session (magic-link exchange) | Everything: cashier management, all receipts (any date), edit/delete with reason, exports, settings, the Amendments log |

The backend has **no concept of "Filer"** — that distinction is entirely
client-side (a name-matching list stored in `app_settings`). This was a
deliberate choice so adding/removing Filers never requires a schema change
or touching the `cashiers` table.

---

## 3. Required Supabase objects — status

### Edge Functions
| Function | Status | Notes |
|---|---|---|
| `verify-totp` | ✅ Deployed (confirmed v3, pre-existing) | Checks the code against `cashiers` then `admin_totp`; issues a `cashier_sessions` token or a real Auth session |
| `submit-receipt` | ✅ Deployed (confirmed v2, pre-existing) | The only path that can insert into `receipts` |
| `get-today-history` | ✅ Deployed and **confirmed working** this session (v1) | Added new — validates the token against `cashier_sessions`, returns receipts for a date range. Used by both the Filer Panel and the cashier's own History tab |

### Tables (existing, pre-dating this work)
`receipts`, `cashiers`, `cashier_sessions`, `admin_totp`, `app_settings` —
all already in place; none of their schemas were altered by this build.

### Tables — ⚠️ ACTION NEEDED
| Table | Status | Required for |
|---|---|---|
| `amendments` | **Not confirmed created.** The exact SQL migration was handed off earlier in this build, but no confirmation was ever received that it was actually run. | The Edit-receipt and Delete-receipt features, and the Amendments log tab. Without this table, Edit/Delete will fail with a "relation does not exist" style error, and the Amendments tab will show a message saying so. |

**Before relying on Edit/Delete/Amendments, run this once** (Supabase SQL
editor, or hand to Supabase's assistant with an explicit "only create this
table, touch nothing else" instruction):

```sql
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

create policy "admin full access" on amendments
  for all
  to authenticated
  using (true)
  with check (true);
```

Also confirm the `receipts` table's RLS policy permits `UPDATE` for the
admin's authenticated session (it already permits `DELETE`, since that
already works — `UPDATE` is the one new permission Edit-receipt needs).

---

## 4. Feature summary (1.0.0 → 1.6.1)

- Cashier sale entry, receipts, gate passes, daily local history
- Admin: cashier management, full receipt history with date filtering
- Exports: CSV (Items + Payments, linked by Receipt ID), XLSX (single
  grouped "Statement" sheet — Receipt/Item/Payment/Total rows with native
  Excel outline grouping), full-fidelity JSON, and a **Yarding export**
  (a real Yarding module package `.json` — arrives in Yarding already
  marked paid, with ledger postings, matched to Yarding's own account
  names by name so nothing duplicates, and safe to re-import)
- WhatsApp messages (customer, office, owner, full statement) carry
  complete structured detail — vehicle/driver, full reimbursement fields,
  itemized statements — nothing collapsed into a single line
- Printed statement: one row per item and one row per payment per receipt,
  never joined into a single cell. Carries every field the record holds,
  including vehicle/driver and item description
- Gate passes: every item field labelled (Category/Vessel/Description),
  items numbered, with an item-count and total-quantity tally line for
  gate verification. Never shows prices
- "Round totals" setting: rounds grand totals to the nearest whole Tk
  (standard rounding, not always-up) for display only — never changes
  actual payment-collection math
- All dates/times are fixed to **Asia/Dhaka (UTC+6)**, independent of any
  device's own clock or timezone setting
- **Filer role**: read-only, today-only, full parity with admin's output
  options (Print/CSV/XLSX/JSON/Yarding/WhatsApp), no sale entry/edit/delete
- **Receipt editing** (admin only): client, vehicle, items, payments,
  reimbursement — all editable, with live-recalculated totals and required
  validation
- **Amendments log**: every edit and delete, with who/when/reason and full
  before/after detail. Append-only — nothing in it can be changed or
  removed by anyone, including admin
- Versioned in-app "What's new" panel + full changelog (this document's
  companion). **Admin-only** — cashier and filer devices have no entry
  point to it and no text anywhere referencing the admin panel, so neither
  role has any indication it exists
- Payment QR built in by default, shown on a white field with a proper
  quiet zone and tap-to-enlarge for scanning; still overridable from
  Settings

---

## 5. Known limitations / deliberately not done

- **UI/UX has not been restyled to match Yarding.** This was requested
  once, explicitly deferred as a large separate undertaking, and never
  revisited. The POS keeps its own visual identity (MSR wordmark, its own
  color scheme) rather than Yarding's.
- **The `amendments` table's creation is unconfirmed** — see §3 above. This
  is the single most important outstanding action item.
- **Two-way sync with Yarding does not exist.** The Yarding export is
  one-directional (POS → Yarding); nothing feeds back.
- No automated test suite ships with the app — verification during this
  build was done by executing the actual page in a headless browser
  against mocked backends for each feature as it was built, not by a
  standing test file bundled with the app.

---

## 6. If something breaks

The most common historical failure mode in this build was **assuming a
backend piece worked without being able to see it** — twice, an Edge
Function or table was assumed present/correct and turned out not to be.
The one reliable way to move forward on a backend-side issue is the same
pattern that resolved `get-today-history`: get the actual deployed source
of the relevant function (via the Supabase dashboard's code view, or a
downloaded file) into the conversation, rather than reasoning about it from
the client side alone.
