# Handoff — HYC Gate Security Tool

**The file:** `index.html`. One self-contained file — no build step, no backend, no second edition.
**Version:** 2.3.0
**Target:** Chrome (or Edge) on a Windows PC, offline. Also works on GitHub Pages as-is.

Purpose: give the next developer or AI everything needed to change this safely without
re-deriving the architecture.

---

## 1. What this app is

A gate-security kiosk for Mehreen Ship Recycling tracking three kinds of people through one gate:

- **Visitors** — register via a wizard, get a badge + entry permit, checked in/out by security.
- **Staff** — pre-registered once, then tap in/out. Work hours tracked.
- **Workers** — same as staff but a separate category in the UI. **Internally the category value
  is still the string `'LABOURER'` and internal state keys are still `'labourer'`. Only the
  display label changed.** Do not "fix" this — changing the stored value breaks every existing
  record.

Runs entirely client-side. Cloud sync (generic HTTPS endpoint or Supabase) exists but is optional
and off by default. Nothing core requires a network.

---

## 2. File layout — where to edit

Top to bottom:

1. `<style id="embeddedFonts">` — base64 woff2 faces. Vendored.
2. App CSS.
3. **Vendored library blocks**, each preceded by a `VENDORED LIBRARY — DO NOT hand-edit` banner:
   SheetJS, html2canvas, hls.js.
4. **Application code** — everything after the last vendor banner. This is what you edit.

To update a library, swap the contents of its script element for a newer minified build. Do not
hand-patch inside a vendor block.

`SELF_CONTAINED = true` marks that everything is embedded. Face Scan and NID auto-read are the
only features that still fetch anything at runtime (multi-megabyte model/language files); both
degrade gracefully offline.

---

## 3. Storage architecture — read this before touching data code

The part most likely to be broken by a careless change.

### Three stores

| Store | Backing | Holds | Why |
|---|---|---|---|
| `recordCache` | IndexedDB `msrGate2026_records` | visitors, staff, staffAttendance, settings, counters, auditLog | localStorage caps at ~5MB; IndexedDB is bounded by free disk |
| `photoCache` | IndexedDB `msrGate2026_photos` | base64 photos, keyed by `@idbph:` refs | photos are the bulk of the data |
| handles | IndexedDB `msrGate2026_fsapi` | backup-folder handle | a directory handle is not a string |

### The synchronous-API constraint

Every render function calls `DB.get()` synchronously and expects an immediate value. **None await.**
IndexedDB is async-only. Therefore:

- `loadAllRecordsFromIdb()` and `loadAllPhotosFromIdb()` run in `boot()` and **must both finish
  before the first `renderRoute()`**. Do not move renders ahead of them.
- `DB.get()` reads `recordCache` synchronously; `DB.set()` updates the cache immediately then
  writes through to IndexedDB in the background.

New data key? Add it to `REC_KEYS` or it will not be hydrated or migrated.

### Migration rules (do not weaken)

- localStorage is **read and copied forward, never deleted** — the old copy stays as a fallback.
- A key is copied **only when IndexedDB has nothing for it**. If IndexedDB has the key, it wins.
  That ordering is what makes the migration safe to re-run on every boot.
- If IndexedDB is unavailable, everything falls back to the original localStorage path.

### Record shape / not corrupting old data

- `SCHEMA_VERSION` is stamped into every backup. Restore **refuses** a newer-schema payload rather
  than importing it lossily and writing the degraded copy back.
- Normalisation runs on **read**, fills missing fields with safe defaults, guarantees
  `sessions`/`oldIds` are arrays, coerces an unknown staff `category` to `STAFF`, and **always
  preserves unknown fields** so a record from a newer build survives a round-trip through an older
  one. **Never strip a key you do not recognise.**

### Temporal dead zone gotcha

`DB.set()` runs during early initialisation, **before** most `const`/`let` further down the file
exist. Anything it calls must tolerate that. `scheduleAutoBackupSoon()` guards its dependencies
with try/catch for exactly this reason — `typeof` also throws for TDZ bindings, so try/catch is
the only safe guard. A bug here does not crash loudly; it gets swallowed by `DB.set()`'s catch and
misreported as "storage unavailable".

---

## 4. Offline PC hosting

1. Put `index.html` anywhere on the PC, open in Chrome. No server.
2. Settings → Backup → **Choose Folder** (a OneDrive/Drive-synced folder gets off-site copies free).
3. A timestamped JSON backup writes ~4s after any change, pruned to the newest N (default 50).
4. Fresh install or second PC: connect the same folder → **Restore Newest From Folder**.
   Admin-gated, confirmed, safety export first.

`showDirectoryPicker` is Chromium-desktop only; feature-detected everywhere else.

**Do not clear browser site data** without a folder backup or manual export — that is where
IndexedDB lives. Note also that `file://` and `https://…` are *different origins* and do not share
data; move between them via export/restore.

---

## 5. Sharing & CCTV

**Sharing.** No hardcoded recipient anywhere. `shareBadgeFor(id, kind)` prefills the person's
**own** registered phone; `shareGeneric(msg)` leaves it blank for reports/exports. New send paths
must use one of those — do not reintroduce a fixed number.

Hard limit: `wa.me` and `mailto:` carry **text only**. The badge PNG can only be attached via the
Web Share API (`navigator.share({files})`), which works in Chrome on Windows and Android.
Elsewhere, offer Download and say so — never imply the image was sent.

**CCTV.** Browsers cannot open `rtsp://` and cannot speak ONVIF (SOAP over HTTP, blocked by CORS
even on the LAN). No workaround exists from inside a page. The supported path is a local **go2rtc**
bridge; Settings → CCTV generates its config from an RTSP URL.

If you touch the CCTV code, keep these:
- `cctvStopped[trackKey]` must be set **before** teardown and checked in every async callback, or
  a late `<img>` load queues a reconnect after the user has navigated away.
- MJPEG refreshes must chain off load/error, never a blind timer, or slow cameras pile up
  overlapping requests.

---

## 6. Testing

```
npm install jsdom fake-indexeddb
node smoketest.js    # 43 checks — storage, schema, normalisation, sharing, CCTV lifecycle
node routecheck.js   # 46 checks — renders every route/tab/report/builder with hostile data
node libcheck.js     #  8 checks — embedded libraries genuinely work offline
```

`routecheck.js` is the highest-value harness: it renders every screen using deliberately hostile
data (a visitor named `O'Brien <script>`, a worker with no phone or supervisor) and fails on any
thrown error or unescaped markup. **Run it after any UI change.**

**Harness gotcha:** fake-indexeddb must be installed via jsdom's `beforeParse` hook, NOT after
`new JSDOM()` returns. jsdom executes inline scripts during construction, so `boot()` has already
called `openRecordsDB()` and cached its result by then. Getting this wrong does not fail loudly —
it silently tests the localStorage fallback while appearing to test IndexedDB. That happened in
v2.0.0 and went unnoticed for a release.

Not covered: live camera streams, real print output, the real File System Access API. Verify those
by hand.

---

## 7. Deliberate decisions

- **One file, no build.** Earlier versions had an `index.html` source plus a generated
  `index-standalone.html`. That was retired — two editions meant a real risk of shipping a stale
  build and constant ambiguity about which file was authoritative.
- **Access codes are plaintext** in the settings object. Physically-secured single-kiosk trust
  model, not real auth. If hosting publicly (GitHub Pages), change the defaults before publishing —
  they are readable in the source.
- **Print:** Chrome on Windows is the target. Mobile "Save as PDF" pathways substitute their own
  paper size regardless of the requested `@page`. Badge/permit/receipt jobs hide the trailing
  credit footer via `hidePrintFooter()`, which must use
  `setProperty('display','none','important')` — the footer's print CSS is `!important` and a plain
  inline style silently loses to it.
- **Supabase/cloud sync is optional.** No core path may depend on it.

---

## 8. Suggested next work

- Trim or archive `auditLog` by age — it is the fastest-growing key and nothing trims it beyond a
  5000-entry cap.
- Cover the CCTV connect/retry lifecycle with a stubbed stream in the harness.
- A "verify backup" action that reads the newest folder file back and reports record counts, so a
  silently-failing backup is caught before it is needed.
