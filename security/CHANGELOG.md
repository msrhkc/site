# Changelog — HYC Gate Security Tool

One file: `index.html`. Self-contained, no build step, no second edition.
Newest first.

---

## v2.3.0 — 2026-09-13 — Single self-contained file

`index.html` **is** the finished artifact. Everything it needs is embedded in it.

- Retired the two-edition split (`index.html` source + `index-standalone.html` build output) and
  the `build-standalone.js` step with it. There is now one file to edit, test, and deploy — no
  chance of shipping a stale build, and no ambiguity about which file is "the real one".
- Vendored libraries are marked with explicit banners (`VENDORED LIBRARY — DO NOT hand-edit`) so
  the boundary between third-party code and application code is obvious. Application code begins
  after the last vendor block.
- Renamed the `STANDALONE_BUILD` flag to `SELF_CONTAINED` — there is no build any more, so the old
  name described a process that no longer exists.
- Fixed a banner comment that contained a literal script tag inside an HTML comment. Browsers
  parse that correctly so the app was never broken, but it confused tooling (the syntax checker
  matched it as a real tag) and it is a genuine smell. Caught by the checker, not by reading.

**Verified on the single file:** 43/43 smoketest · 46/46 routecheck · 8/8 library check.
0 external scripts, 0 stylesheet links, 0 preconnects.

### Embedded
SheetJS 0.18.5 (XLSX export) · hls.js 1.x (HLS CCTV) · html2canvas 1.4.1 (badge PNG) ·
qrcode (was already vendored) · Lexend, IBM Plex Mono, Big Shoulders Display — 10 latin woff2
faces as base64 `@font-face`.

### Still needs internet (both optional, both fail gracefully)
Face Scan (face-api model weights, ~9MB) and NID auto-read (tesseract worker + ~3MB wasm + ~10MB
language data). Embedding those would roughly quadruple the file for two optional extras.
Everything else — check-in/out, badges, permits, receipts, reports, XLSX, QR, CCTV over
MJPEG/HLS/go2rtc, backups, sharing — works with the network cable unplugged.

---

## v2.2.0 — 2026-09-13

### Changed — sharing no longer routes to a hardcoded number

- **Removed the hardcoded company WhatsApp number** (`8801319001751`). Every badge send previously
  went to that one number, which is almost never the right recipient.
  - From a profile or straight after registration, the recipient box is **prefilled with that
    person's own registered phone**, and is editable.
  - For generic sends (reports, JSON, prints) the box is **left blank** so the officer picks.
  - A settings migration clears the old value, but only if it still matches the exact shipped
    number — a number the site deliberately set themselves is left alone.
  - The settings field is now an optional *fallback* and can be cleared. Previously
    `|| s.whatsappNumber` meant emptying the box silently restored the old value, so the default
    could never actually be removed.
- **New unified share module** (`openShareModal`) replacing `sendWhatsApp` / `promptWhatsAppOther`:
  WhatsApp, email (`mailto:`), Download PNG, and **Share image**.
  - `wa.me` and `mailto:` can carry **text only** — neither can attach an image. Attaching the
    badge PNG is done through the Web Share API (`navigator.share` with files), supported by
    Chrome on Windows and Android. Where unsupported, the UI says so plainly and offers Download
    instead of pretending the image was sent.
  - Number normalisation handles local BD format (`01…` → `8801…`), `+`, and `00` prefixes.
  - Badge PNG rendering is now one shared function (`badgePngBlob`), with the off-screen render
    holder removed in a `finally` block — previously a failed render leaked a hidden full-size
    badge node (and its photo) into memory on every attempt.

### Fixed — CCTV / RTSP module

- **MJPEG polling piled up requests.** The next refresh was scheduled on a blind 1s timer
  regardless of whether the previous one had finished, so any camera slower than the interval (or
  offline) accumulated overlapping in-flight requests indefinitely. Refreshes now chain off
  load/error, so exactly one request per camera is ever in flight.
- **No reconnection at all.** If a feed dropped — NVR reboot, PoE blip, Wi-Fi drop — the tile sat
  dead until the officer navigated away and back. All three source kinds now retry with
  exponential backoff (1s→30s cap), show the attempt count, and never stop trying.
- **Fatal HLS errors after connect were unhandled.** The connect promise only handled errors up to
  `MANIFEST_PARSED`; anything after that froze the tile silently. Now attempts hls.js's own
  `startLoad()` / `recoverMediaError()` first, then a full reconnect.
- **Teardown could be resurrected by late callbacks.** An in-flight `<img>` load or hls.js error
  firing after the user navigated away would queue a fresh reconnect, leaving timers and network
  activity running in the background. A `cctvStopped` flag is now set before teardown and checked
  by every callback.
- Added a per-tile **Retry** button, per-camera **snapshot FPS** (1–10, default 1), colour-coded
  status.
- **RTSP/ONVIF guidance made actionable.** A browser cannot open `rtsp://` and cannot speak ONVIF
  (SOAP over HTTP, blocked by CORS even on the LAN) — a hard browser limit, not an app gap. The
  CCTV settings tab now explains this and includes a **go2rtc config generator**: paste an RTSP
  URL, get a ready-to-paste `go2rtc.yaml`, with the stream name auto-derived from the camera name
  so the two cannot drift apart (the usual cause of "stream not found").

### Added — information management that cannot corrupt old data

- **`SCHEMA_VERSION` (3)** stamped into every backup payload alongside `appVersion`.
- **Restore refuses a backup from a newer schema** rather than importing it lossily and writing the
  degraded copy back — which is exactly how a "successful" restore becomes data loss.
- **Payload shape validation before touching the live store**, so a truncated or corrupted file is
  rejected outright instead of half-applied.
- **Record normalisation on read** (`normalizeVisitor` / `normalizeStaff` / `normalizeAttendance`):
  missing fields get safe defaults, `sessions`/`oldIds` are guaranteed arrays, an unknown staff
  `category` is coerced to `STAFF`. Critically, **unknown fields are always preserved** — a record
  written by a newer build and opened in an older one survives the round-trip intact. Malformed
  entries are dropped rather than crashing a render mid-page.
- Normalisation happens on **read, not write**, so records are only rewritten when the user
  actually edits something.

---

## v2.0.0 — 2026-09-13 — Storage moved off localStorage

### Fixed — "running out of memory"

- **Records now live in IndexedDB instead of localStorage.** localStorage is capped at roughly
  5MB per origin by every browser, regardless of the PC's RAM or disk. Photos had already been
  moved out; the records themselves — visitors, staff, attendance, and especially the audit log —
  kept growing inside that 5MB box until saves began failing mid-shift.
  - `DB.get()` / `DB.set()` keep their **synchronous** signatures, backed by an in-memory cache
    hydrated during `boot()` with write-through to disk. No call sites changed.
  - Falls back to the previous localStorage behaviour if IndexedDB is unavailable.
- **Auto-backup folder pruning never worked.** The retention regex was
  `/^msrGate2026_autobackup_.*\\.json$/` — the doubled backslash matches a literal backslash, which
  no filename contains. Nothing was ever pruned and the folder grew without limit. Retention is now
  configurable (default 50).
- **Storage-full warning fired against the wrong ceiling** (3.5MB is meaningless once records are
  in IndexedDB). Suppressed on that path.
- **Temporal-dead-zone crash on first settings write.** `DB.set()` runs during early init and calls
  `scheduleAutoBackupSoon()`, which touched a `const` declared much later. The resulting
  `ReferenceError` was swallowed and misreported as "storage unavailable". Found by the test
  harness, not by inspection.

### Added — offline PC hosting
- Debounced autosave to a PC folder (~4s after any change, was a 3-minute timer).
- **Restore Newest From Folder** — admin-gated, confirmed, safety export first.
- Configurable retention; `APP_VERSION` shown in the footer.

### Changed
- `applyBackupPayload()` — one shared restore path for file import, cloud pull, and folder restore.

### Notes
- Migration is **non-destructive**: localStorage copies are read, copied forward, and left in
  place. IndexedDB wins for any key it already holds, so a stale snapshot can never clobber newer
  data.
- Supabase/cloud sync remains optional and off by default.

---

## Earlier

Not formally tracked. Notable prior work: personal per-officer security codes; Labourer → Worker
rename; supervisor grouping with one-click group checkout; bulk badge-sheet printing;
receipt-style entry pass; CCTV viewing tab; print pipeline fixes; POS-matched visual design.
