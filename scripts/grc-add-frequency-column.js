// ═══════════════════════════════════════════════════════════════════════════
//  Tree Digital Insurance — Add ReportingFrequency column to GRC_KRI_Master
//
//  WHAT THIS DOES:
//    1. Adds a Text column "ReportingFrequency" to GRC_KRI_Master if missing
//    2. Sets all existing KRIs (that don't already have a value) to "Monthly"
//       so nothing breaks while the GRC team updates them KRI-by-KRI.
//
//  HOW TO RUN
//    1. Open https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard
//    2. Open DevTools console (F12)
//    3. Paste this entire script and press Enter
//    4. Wait — about 1-2 minutes for 91 KRIs
//
//  Safe to re-run: skips items that already have a frequency set.
// ═══════════════════════════════════════════════════════════════════════════

(async function addFrequencyColumn() {
  'use strict';

  const SITE = (() => {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(\/(?:sites|teams|portals|personal)\/[^/]+)/i);
    return match ? origin + match[1] : origin;
  })();

  const LIST = 'GRC_KRI_Master';
  const COL  = 'ReportingFrequency';
  const DEFAULT_VALUE = 'Monthly';

  console.group('%cGRC — Add ReportingFrequency column', 'font-weight:bold;font-size:14px');
  console.log('Target:', SITE + '/' + LIST);

  async function getDigest() {
    const r = await fetch(SITE + '/_api/contextinfo', {
      method: 'POST',
      headers: { Accept: 'application/json;odata=nometadata' },
      credentials: 'include',
    });
    if (!r.ok) throw new Error('Cannot get digest — are you logged into SharePoint?');
    const d = await r.json();
    return d.FormDigestValue;
  }
  const spGet = (url) => fetch(SITE + url, { headers: { Accept: 'application/json;odata=nometadata' }, credentials: 'include' });

  let digest = await getDigest();

  const exists = await spGet(`/_api/web/lists/getbytitle('${LIST}')`);
  if (!exists.ok) {
    console.error('  ✗ List not found. Aborting.');
    console.groupEnd();
    return;
  }

  // ── Step 1: Add the column if missing ─────────────────────────────────────
  console.group('Step 1: Add column');
  const check = await spGet(`/_api/web/lists/getbytitle('${LIST}')/fields/getbyinternalnameortitle('${COL}')`);
  if (check.ok) {
    console.log(`  ↩ ${COL} already exists`);
  } else {
    digest = await getDigest();
    const r = await fetch(SITE + `/_api/web/lists/getbytitle('${LIST}')/fields`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest,
      },
      credentials: 'include',
      body: JSON.stringify({
        __metadata: { type: 'SP.FieldText' },
        FieldTypeKind: 2,
        Title: COL,
        Required: false,
      }),
    });
    if (r.ok) console.log(`  ✓ Added ${COL}`);
    else      console.warn(`  ⚠ Failed to add ${COL}:`, (await r.text()).slice(0, 200));
  }
  console.groupEnd();

  // ── Step 2: Backfill default value for existing KRIs ──────────────────────
  console.group('Step 2: Backfill default value');
  let pageUrl = `/_api/web/lists/getbytitle('${LIST}')/items?$select=ID,Title,${COL}&$top=2000`;
  const items = [];
  while (pageUrl) {
    const r = await spGet(pageUrl);
    if (!r.ok) break;
    const j = await r.json();
    (j.value || []).forEach(it => items.push(it));
    pageUrl = j['odata.nextLink'] ? j['odata.nextLink'].replace(SITE, '') : null;
  }
  console.log(`  Found ${items.length} KRIs`);

  let updated = 0, skipped = 0;
  for (const it of items) {
    if (it[COL]) { skipped++; continue; }
    digest = await getDigest();
    const r = await fetch(SITE + `/_api/web/lists/getbytitle('${LIST}')/items(${it.ID})`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'X-RequestDigest': digest,
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE',
      },
      credentials: 'include',
      body: JSON.stringify({ [COL]: DEFAULT_VALUE }),
    });
    if (r.ok) {
      updated++;
      if (updated % 20 === 0) console.log(`    ✓ ${updated}/${items.length}`);
    }
  }
  console.log(`  ✓ Set to '${DEFAULT_VALUE}': ${updated} · Skipped (already set): ${skipped}`);
  console.groupEnd();

  console.log('%c✓ Done', 'color:#16a34a;font-weight:bold');
  console.groupEnd();
})();
