# Version Log — HYC Gate Security Tool

Known-good snapshots of `index.html`, newest first. Snapshots live in `versions/`.
To roll back: copy the snapshot over `index.html`. That is the whole procedure — there is no
build step and no second edition to keep in sync.

---

## v2.3.0 — `versions/index-v2.3.0.html`  ✅ LAST KNOWN GOOD

**Date:** 2026-09-13
**Size:** 2.40MB (self-contained)

**Tests — all against the single file:**
- `node smoketest.js` — **43/43** (storage migration, schema guards, normalisation, share routing,
  CCTV lifecycle)
- `node routecheck.js` — **46/46** (every route, settings tab, sub-tab, report type and
  print/share builder, using hostile data)
- `node libcheck.js` — **8/8** (embedded libraries genuinely work offline, including generating a
  real XLSX workbook with no network)

**Self-containment verified:** 0 external `<script src>`, 0 stylesheet `<link>`, 0 preconnects.

**What changed:** collapsed to one file; retired the build step and the standalone edition; vendor
blocks banner-marked; `STANDALONE_BUILD` → `SELF_CONTAINED`; fixed a banner comment containing a
literal script tag.

**Known limitations at this version:**
- **Face Scan** and **NID auto-read** still need internet on first use (multi-megabyte model and
  language files). Both optional; both fail with a clear message offline.
- **Camera streams are not covered by the harness** — no live camera in the test environment. The
  connect/retry logic is exercised structurally, but verify against a real feed after any change
  to the CCTV module.
- **Print output is not covered by the harness.** Chrome on Windows is the supported target.
  Mobile "Save as PDF" pathways have repeatedly substituted their own paper size regardless of the
  requested `@page` size and are not a supported configuration.
- `showDirectoryPicker` (folder autosave/restore) is Chromium-desktop only. Feature-detected; other
  browsers are told plainly and pointed at manual export.

---

## v2.2.0 — sharing rewrite, CCTV self-healing, schema versioning
Superseded by v2.3.0. Functionally identical; v2.3.0 only collapsed the two editions into one file.

## v2.1.0 — first standalone build
Superseded. Introduced the now-retired `index.html` + `index-standalone.html` split.

## v2.0.0 — storage moved to IndexedDB
Superseded. Note: its "21/21" partly measured the localStorage fallback — the harness installed
fake-indexeddb too late (fixed in v2.1.0 by using jsdom's `beforeParse`).

## Pre-2.0.0
Not snapshotted. Carries the ~5MB storage ceiling and the unbounded backup-folder growth bug.
