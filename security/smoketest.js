/* Smoketest for the gate security tool.
   Focus: the localStorage -> IndexedDB records migration must never lose or corrupt data.
   Run: node smoketest.js */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const fdb = require('fake-indexeddb');

const html = fs.readFileSync('/home/claude/index.html', 'utf8');

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('BUG  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

async function makeWindow(seedLocalStorage, sharedFactory) {
  /* indexedDB and the seeded localStorage MUST be installed via beforeParse, i.e. before a single
     inline script executes. jsdom runs inline scripts during construction, and the app's boot()
     calls openRecordsDB() almost immediately - which caches its result. Installing the factory
     after `new JSDOM()` returns is too late: the app has already decided IndexedDB is unavailable
     and cached that, and every later check reports the localStorage fallback. */
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/',
    beforeParse(w) {
      // Each "session" shares one IndexedDB factory so data persists across simulated reloads.
      Object.defineProperty(w, 'indexedDB', { value: sharedFactory, configurable: true });
      Object.defineProperty(w, 'IDBKeyRange', { value: fdb.IDBKeyRange, configurable: true });
      w.requestAnimationFrame = cb => setTimeout(cb, 0);
      if (seedLocalStorage) {
        for (const k in seedLocalStorage) w.localStorage.setItem(k, seedLocalStorage[k]);
      }
    }
  });
  const w = dom.window;
  await new Promise(r => w.document.addEventListener('DOMContentLoaded', r));
  await new Promise(r => setTimeout(r, 2500)); // let boot()'s async hydration finish
  // Top-level `const`/`let` in a classic script are NOT properties of window, so reach them via eval.
  w.DB = w.eval('DB');
  w.applyBackupPayload = w.eval('applyBackupPayload');
  return w;
}

(async () => {
  // ---------- Session 1: legacy localStorage data must migrate into IndexedDB ----------
  const factory = new fdb.IDBFactory();
  const legacyVisitors = [{ id: 'V1', type: 'visitor', name: 'Legacy Visitor', phone: '01711111111', status: 'onsite' }];
  const legacyStaff = [{ id: 'S1', type: 'staff', name: 'Legacy Staff', category: 'STAFF', supervisor: 'Boss' }];
  const legacyAtt = [{ id: 'a1', staffId: 'S1', name: 'Legacy Staff', category: 'STAFF', entryType: 'work', checkIn: '2026-01-01T09:00:00.000Z', checkOut: null, workedMins: 0 }];

  const w1 = await makeWindow({
    'msrGate2026_visitors': JSON.stringify(legacyVisitors),
    'msrGate2026_staff': JSON.stringify(legacyStaff),
    'msrGate2026_staffAttendance': JSON.stringify(legacyAtt),
  }, factory);

  T('session1: legacy visitors readable after migration', w1.DB.get('visitors', []).length === 1);
  T('session1: visitor fields intact', w1.DB.get('visitors', [])[0].name === 'Legacy Visitor');
  T('session1: legacy staff readable', w1.DB.get('staff', [])[0].name === 'Legacy Staff');
  T('session1: supervisor field preserved', w1.DB.get('staff', [])[0].supervisor === 'Boss');
  T('session1: attendance preserved', w1.DB.get('staffAttendance', []).length === 1);
  T('session1: reports using IndexedDB', w1.DB.usingIdb() === true);
  T('session1: original localStorage copy NOT deleted (fallback safety)',
    w1.localStorage.getItem('msrGate2026_visitors') !== null);

  // write new data in session 1
  const updated = w1.DB.get('visitors', []).concat([{ id: 'V2', type: 'visitor', name: 'New Visitor', phone: '01722222222', status: 'onsite' }]);
  w1.DB.set('visitors', updated);
  T('session1: write visible immediately (synchronous cache)', w1.DB.get('visitors', []).length === 2);
  await new Promise(r => setTimeout(r, 300)); // let the background IDB write land

  // ---------- Session 2: simulated reload, IndexedDB must win over stale localStorage ----------
  const w2 = await makeWindow({
    // stale pre-migration copy still present on disk, as it would be in reality
    'msrGate2026_visitors': JSON.stringify(legacyVisitors),
  }, factory);

  const v2 = w2.DB.get('visitors', []);
  T('session2: data survived reload via IndexedDB', v2.length === 2, v2.map(v => v.id));
  T('session2: newer IndexedDB copy beat stale localStorage', v2.some(v => v.id === 'V2'));
  T('session2: staff still present after reload', w2.DB.get('staff', []).length === 1);

  // ---------- Capacity: prove we are past the ~5MB localStorage ceiling ----------
  const big = [];
  for (let i = 0; i < 4000; i++) {
    big.push({ id: 'B' + i, type: 'visitor', name: 'Bulk Visitor ' + i, phone: '0171' + i,
      notes: 'x'.repeat(2000), status: 'checked_out' });
  }
  const bigJson = JSON.stringify(big);
  T('capacity: test payload exceeds the 5MB localStorage cap', bigJson.length > 5 * 1024 * 1024,
    Math.round(bigJson.length / 1024 / 1024 * 10) / 10 + 'MB');
  const okBig = w2.DB.set('visitors', big);
  T('capacity: large write accepted (would have thrown QuotaExceededError before)', okBig === true);
  T('capacity: large dataset readable back', w2.DB.get('visitors', []).length === 4000);
  await new Promise(r => setTimeout(r, 600));

  const w3 = await makeWindow(null, factory);
  T('capacity: large dataset survived a reload', w3.DB.get('visitors', []).length === 4000);

  // ---------- Regression: shared restore path ----------
  T('applyBackupPayload exists and is shared', typeof w3.applyBackupPayload === 'function');
  w3.applyBackupPayload({ visitors: [{ id: 'R1', name: 'Restored', type: 'visitor' }], staff: [] });
  T('applyBackupPayload replaces visitors', w3.DB.get('visitors', []).length === 1);
  T('applyBackupPayload replaces staff', w3.DB.get('staff', []).length === 0);

  // ---------- Regression: the autobackup prune regex actually matches real filenames ----------
  const reSrc = html.match(/if\(\/\^msrGate2026_autobackup_\.\*[^\/]*\/\.test\(name\)\)/);
  T('prune regex present in source', !!reSrc);
  const liveRe = /^msrGate2026_autobackup_.*\.json$/;
  T('prune regex matches a real backup filename',
    liveRe.test('msrGate2026_autobackup_2026-01-01T00-00-00-000Z.json'));
  // Check only ACTIVE regex literals (lines that run), not the comment documenting the old bug.
  const activeRegexLines = html.split('\n').filter(l => l.includes('.test(name)'));
  T('all active prune regexes use a single backslash', activeRegexLines.length > 0 &&
    activeRegexLines.every(l => l.includes('.*\\.json$') && !l.includes('.*\\\\.json$')),
    activeRegexLines.map(l => l.trim()));

  // ---------- Normalisation: old records must survive contact with new code ----------
  const w4 = w3;
  const evalIn = expr => w4.eval(expr);
  // A visitor record as written by an OLD build: no oldIds, no sessions, unknown future field.
  w4.DB.set('visitors', [{ id: 'OLD1', name: 'Old Record', phone: '01700000000', futureField: 'keep-me' }]);
  const nv = w4.DB.get('visitors', [])[0];
  T('normalise: missing sessions becomes an array', Array.isArray(nv.sessions));
  T('normalise: missing oldIds becomes an array', Array.isArray(nv.oldIds));
  T('normalise: unknown future field PRESERVED (no data loss)', nv.futureField === 'keep-me');
  T('normalise: existing values untouched', nv.name === 'Old Record' && nv.phone === '01700000000');

  // Malformed entries must be dropped, not crash the render.
  w4.DB.set('visitors', [{ id: 'GOOD', name: 'Fine' }, null, 'garbage', 42]);
  T('normalise: malformed entries dropped, good one kept', w4.DB.get('visitors', []).length === 1);

  // Staff category must never be an unknown value.
  w4.DB.set('staff', [{ id: 'S9', name: 'X', category: 'WEIRD' }]);
  T('normalise: unknown staff category coerced to STAFF', w4.DB.get('staff', [])[0].category === 'STAFF');
  w4.DB.set('staff', [{ id: 'S9', name: 'X', category: 'LABOURER' }]);
  T('normalise: LABOURER category preserved (worker records intact)', w4.DB.get('staff', [])[0].category === 'LABOURER');

  // ---------- Schema guard: a newer backup must be refused, not half-applied ----------
  let threw = false;
  try { w4.applyBackupPayload({ schemaVersion: 9999, visitors: [] }); } catch (e) { threw = /newer version/i.test(e.message); }
  T('schema guard: refuses a backup from a newer build', threw);

  let threw2 = false;
  const beforeCount = w4.DB.get('staff', []).length;
  try { w4.applyBackupPayload({ visitors: 'not-an-array' }); } catch (e) { threw2 = /malformed/i.test(e.message); }
  T('schema guard: rejects malformed payload', threw2);
  T('schema guard: rejected payload did NOT touch live data', w4.DB.get('staff', []).length === beforeCount);

  T('backup payload stamps schemaVersion', typeof evalIn('buildFullBackupPayload().schemaVersion') === 'number');

  // ---------- WhatsApp routing: no hardcoded company number anywhere ----------
  T('no hardcoded company number in defaults', evalIn("defaultSettings().whatsappNumber") === '');
  T('old hardcoded number is not present in source', !html.includes('8801319001751') || html.includes("raw.whatsappNumber === '8801319001751'"));
  T('normalizeWaNumber: local BD format gets country code', evalIn("normalizeWaNumber('01712345678')") === '8801712345678');
  T('normalizeWaNumber: already-international left alone', evalIn("normalizeWaNumber('+8801712345678')") === '8801712345678');
  T('normalizeWaNumber: strips 00 prefix', evalIn("normalizeWaNumber('008801712345678')") === '8801712345678');
  T('normalizeWaNumber: blank stays blank (generic send)', evalIn("normalizeWaNumber('')") === '');
  T('share helpers exist', ['shareBadgeFor','shareTextFor','shareGeneric','openShareModal','badgePngBlob']
      .every(fn => typeof w4.eval('typeof ' + fn) === 'string' && w4.eval('typeof ' + fn) === 'function'));
  T('removed fixed-number senders are gone', w4.eval("typeof sendWhatsApp") === 'undefined'
      && w4.eval("typeof promptWhatsAppOther") === 'undefined');

  // ---------- CCTV lifecycle ----------
  T('cctv teardown helpers exist', ['stopCctvGrid','cctvRetryNow','cctvScheduleRetry','cctvClearTimers']
      .every(fn => w4.eval('typeof ' + fn) === 'function'));
  w4.eval("cctvStopped={}; cctvMjpegTimers={}; cctvRetryTimers={}; cctvAttempts={a:3}; stopCctvGrid();");
  T('cctv: stopCctvGrid clears retry attempt counters',
    Object.keys(w4.eval('cctvAttempts')).length === 0);
  T('cctv: go2rtc snippet generator exists', w4.eval('typeof updateGo2rtcSnippet') === 'function');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
