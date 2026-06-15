// ═══════════════════════════════════════════════════════════════════════════
//  Tree Digital Insurance — GRC Auxiliary Lists Cleanup
//
//  WHAT THIS DOES (destructive):
//    Deletes ALL items from these 4 GRC SharePoint lists:
//      - GRC_RiskRegister        (Top Risks by Score)
//      - GRC_RiskAppetite        (Risk Appetite by Category)
//      - GRC_AuditFindings       (Audit Findings Summary)
//      - GRC_CorrectiveActions   (Corrective Actions Progress)
//      - GRC_KRI_Readings        (KRI Readings)
//
//    Does NOT touch GRC_KRI_Master (use grc-kri-migration.js for that).
//
//  HOW TO RUN
//    1. Open https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard
//    2. Open DevTools console (F12)
//    3. Paste this entire script and press Enter
//    4. Wait — total time depends on item count (~1-2 minutes typical)
// ═══════════════════════════════════════════════════════════════════════════

(async function clearGRCLists() {
  'use strict';

  const SITE = (() => {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(\/(?:sites|teams|portals|personal)\/[^/]+)/i);
    return match ? origin + match[1] : origin;
  })();

  const LISTS = [
    'GRC_RiskRegister',
    'GRC_RiskAppetite',
    'GRC_AuditFindings',
    'GRC_CorrectiveActions',
    'GRC_KRI_Readings',
  ];

  console.group('%cGRC Auxiliary Lists Cleanup', 'font-weight:bold;font-size:14px');
  console.log('Target site:', SITE);

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

  const spGet = (url) => fetch(SITE + url, {
    headers: { Accept: 'application/json;odata=nometadata' },
    credentials: 'include',
  });

  let totalDeleted = 0;

  for (const listName of LISTS) {
    console.group(`Clearing ${listName}`);

    // Check list exists
    const exists = await spGet(`/_api/web/lists/getbytitle('${listName}')`);
    if (!exists.ok) {
      console.warn(`  ⚠ List not found — skipping`);
      console.groupEnd();
      continue;
    }

    // Collect all item IDs
    let pageUrl = `/_api/web/lists/getbytitle('${listName}')/items?$select=ID&$top=2000`;
    const ids = [];
    while (pageUrl) {
      const r = await spGet(pageUrl);
      if (!r.ok) break;
      const j = await r.json();
      (j.value || []).forEach(it => ids.push(it.ID));
      pageUrl = j['odata.nextLink'] ? j['odata.nextLink'].replace(SITE, '') : null;
    }
    console.log(`  Found ${ids.length} items`);

    // Delete each
    let deleted = 0, failed = 0;
    for (const id of ids) {
      const digest = await getDigest();
      const r = await fetch(SITE + `/_api/web/lists/getbytitle('${listName}')/items(${id})`, {
        method: 'POST',
        headers: {
          Accept: 'application/json;odata=nometadata',
          'X-RequestDigest': digest,
          'IF-MATCH': '*',
          'X-HTTP-Method': 'DELETE',
        },
        credentials: 'include',
      });
      if (r.ok) {
        deleted++;
        if (deleted % 25 === 0) console.log(`    ✓ ${deleted}/${ids.length}`);
      } else {
        failed++;
      }
    }
    console.log(`  ✓ Deleted ${deleted}/${ids.length}` + (failed ? ` (${failed} failed)` : ''));
    totalDeleted += deleted;
    console.groupEnd();
  }

  console.log(`%c✓ Cleanup complete — ${totalDeleted} items deleted across ${LISTS.length} lists`, 'color:#16a34a;font-weight:bold');
  console.groupEnd();
})();
