// Builds scripts/grc-historical-readings.js — a console script that:
// 1. Adds Justification + ActionPlan columns to GRC_KRI_Readings if missing
// 2. Updates ReportingFrequency = "Quarterly" for every KRI that has historical data
// 3. Inserts all extracted readings
const fs = require('fs');
const path = require('path');

const readings = require('./historical-readings.json');

// Unique KRIIDs that have historical data → set to Quarterly
const quarterlyKRIs = [...new Set(readings.map(r => r.KRIID))].sort();

// Trim to fields that go to SP
const compact = readings.map(r => ({
  KRIID:         r.KRIID,
  KRIName:       r.KRITitle,
  Period:        r.Period,
  ActualValue:   r.ActualValue,
  RAGStatus:     r.RAGStatus,
  Comments:      r.Comments || '',
  Justification: r.Justification || '',
  ActionPlan:    r.ActionPlan || '',
}));

const script = `// ═══════════════════════════════════════════════════════════════════════════
//  Tree Digital Insurance — GRC Historical KRI Readings Import
//
//  WHAT THIS DOES:
//    1. Ensures Justification + ActionPlan columns exist on GRC_KRI_Readings (Notes)
//    2. Sets ReportingFrequency = "Quarterly" for ${quarterlyKRIs.length} KRIs with historical data
//    3. Inserts ${compact.length} historical readings covering 2025-Q1 → 2026-Q1
//
//  HOW TO RUN
//    1. Open https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard
//    2. Open DevTools console (F12)
//    3. Paste this entire script and press Enter
//    4. Wait — total time ~7-10 minutes
//
//  IDEMPOTENT: re-running adds the columns once (skips if present), updates
//  frequencies, and re-inserts readings (will create duplicates if re-run —
//  delete from list view first if you need a clean re-run).
// ═══════════════════════════════════════════════════════════════════════════

const READINGS = ${JSON.stringify(compact, null, 2)};

const QUARTERLY_KRIS = ${JSON.stringify(quarterlyKRIs)};

(async function importHistorical() {
  'use strict';

  const SITE = (() => {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(\\/(?:sites|teams|portals|personal)\\/[^/]+)/i);
    return match ? origin + match[1] : origin;
  })();

  const MASTER   = 'GRC_KRI_Master';
  const READINGS_LIST = 'GRC_KRI_Readings';

  console.group('%cGRC Historical Readings Import', 'font-weight:bold;font-size:14px');
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

  let digest = await getDigest();

  // ── Step 1: Add Justification + ActionPlan columns to GRC_KRI_Readings ────
  console.group('Step 1: Ensure Justification + ActionPlan columns exist');
  const newCols = [
    { Title: 'Justification', FieldTypeKind: 3 }, // Note
    { Title: 'ActionPlan',    FieldTypeKind: 3 }, // Note
  ];
  for (const col of newCols) {
    const check = await spGet(\`/_api/web/lists/getbytitle('\${READINGS_LIST}')/fields/getbyinternalnameortitle('\${col.Title}')\`);
    if (check.ok) {
      console.log('  ↩ ' + col.Title + ' already exists');
      continue;
    }
    digest = await getDigest();
    const r = await fetch(SITE + \`/_api/web/lists/getbytitle('\${READINGS_LIST}')/fields\`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest,
      },
      credentials: 'include',
      body: JSON.stringify({
        __metadata: { type: 'SP.FieldMultiLineText' },
        FieldTypeKind: col.FieldTypeKind,
        Title: col.Title,
        Required: false,
        RichText: false,
        AppendOnly: false,
      }),
    });
    if (r.ok) console.log('  ✓ Added ' + col.Title);
    else console.warn('  ⚠ Failed to add ' + col.Title + ':', (await r.text()).slice(0, 200));
  }
  console.groupEnd();

  // ── Step 2: Update ReportingFrequency for KRIs that have historical data ──
  console.group('Step 2: Set Quarterly frequency for ' + QUARTERLY_KRIS.length + ' KRIs');
  // Fetch all KRIs to get their SP ID
  const masterRes = await spGet(\`/_api/web/lists/getbytitle('\${MASTER}')/items?$select=ID,KRIID,ReportingFrequency&$top=2000\`);
  const masterItems = (await masterRes.json()).value || [];
  const idByKRI = {};
  masterItems.forEach(it => { if (it.KRIID) idByKRI[it.KRIID] = it.ID; });

  let updated = 0, skipped = 0;
  for (const kriId of QUARTERLY_KRIS) {
    const spId = idByKRI[kriId];
    if (!spId) { skipped++; continue; }
    digest = await getDigest();
    const r = await fetch(SITE + \`/_api/web/lists/getbytitle('\${MASTER}')/items(\${spId})\`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'X-RequestDigest': digest,
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE',
      },
      credentials: 'include',
      body: JSON.stringify({ ReportingFrequency: 'Quarterly' }),
    });
    if (r.ok) {
      updated++;
      if (updated % 20 === 0) console.log('  ✓ ' + updated + '/' + QUARTERLY_KRIS.length);
    } else {
      skipped++;
    }
  }
  console.log('  ✓ Set Quarterly: ' + updated + ' · Skipped: ' + skipped);
  console.groupEnd();

  // ── Step 3: Insert all historical readings ────────────────────────────────
  console.group('Step 3: Insert ' + READINGS.length + ' historical readings');
  let inserted = 0, failed = 0;
  for (const r of READINGS) {
    digest = await getDigest();
    // Coerce numeric ActualValue when possible; SP field is Number
    let actual = r.ActualValue;
    if (typeof actual === 'string') {
      const m = actual.match(/-?\\d+(\\.\\d+)?/);
      actual = m ? parseFloat(m[0]) : null;
    }
    if (actual == null || !Number.isFinite(actual)) { failed++; continue; }

    const body = {
      Title:        (r.KRIID || '') + '-' + r.Period,
      KRIID:        r.KRIID,
      KRIName:      r.KRIName,
      ReadingDate:  new Date().toISOString(),
      ActualValue:  actual,
      Period:       r.Period,
      RAGStatus:    r.RAGStatus || null,
      Trend:        'Stable',
      Comments:     r.Comments || '',
      Justification:r.Justification || '',
      ActionPlan:   r.ActionPlan || '',
    };
    const resp = await fetch(SITE + \`/_api/web/lists/getbytitle('\${READINGS_LIST}')/items\`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'X-RequestDigest': digest,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      inserted++;
      if (inserted % 25 === 0) console.log('  ✓ ' + inserted + '/' + READINGS.length);
    } else {
      failed++;
      if (failed <= 5) {
        const t = await resp.text();
        console.warn('  ⚠ ' + r.KRIID + ' ' + r.Period + ' — ' + t.slice(0, 200));
      }
    }
  }
  console.log('  ✓ Inserted: ' + inserted + ' / ' + READINGS.length + (failed ? ' (failed: ' + failed + ')' : ''));
  console.groupEnd();

  console.log('%c✓ Historical import complete', 'color:#16a34a;font-weight:bold');
  console.groupEnd();
})();
`;

const outPath = path.join(__dirname, 'grc-historical-readings.js');
fs.writeFileSync(outPath, script);
console.log('Wrote:', outPath);
console.log('Size:', (fs.statSync(outPath).size / 1024).toFixed(1), 'KB');
console.log('Readings embedded:', compact.length);
console.log('Quarterly KRIs   :', quarterlyKRIs.length);
