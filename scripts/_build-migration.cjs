// One-shot build script: generates scripts/grc-kri-migration.js by combining
// the script template with the parsed KRIs JSON. Not used at runtime.
const fs = require('fs');
const path = require('path');

const krisRaw = require('./tree-kris.json');
const kris = krisRaw.map(k => ({
  Title: k.Title,
  KRIID: k.KRIID,
  KRICategory: k.KRICategory,
  BusinessUnit: k.BusinessUnit,
  MeasurementUnit: k.MeasurementUnit,
  GreenThreshold: k.GreenThreshold,
  AmberThreshold: k.AmberThreshold,
  RedThreshold: k.RedThreshold,
  ThresholdDirection: k.ThresholdDirection,
  IsActive: k.IsActive,
  SubCategory: k.SubCategory,
  RiskCategoryL1: k.RiskCategoryL1,
  Metric: k.Metric,
  BaseData: k.BaseData,
  DataSource: k.DataSource,
}));

const script = `// ═══════════════════════════════════════════════════════════════════════════
//  Tree Digital Insurance — GRC KRI Migration Script
//
//  WHAT THIS DOES (destructive — replaces all existing KRIs):
//    1. Deletes all existing items in GRC_KRI_Master
//    2. Drops old Number threshold columns (Green/Amber/Red) if present
//    3. Adds 8 new columns:
//       - GreenThreshold, AmberThreshold, RedThreshold  (Text — accepts '>=1', 'In Between', etc.)
//       - SubCategory, RiskCategoryL1                   (Text)
//       - Metric, BaseData                              (Note — multi-line)
//       - DataSource                                    (Text)
//    4. Inserts ${kris.length} KRIs from Tree KRIs.xlsx
//
//  HOW TO RUN
//    1. Open https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard
//    2. Open DevTools console (F12)
//    3. Paste this entire script and press Enter
//    4. Wait — total time ~3-5 minutes for ${kris.length} KRIs
// ═══════════════════════════════════════════════════════════════════════════

const KRIS = ${JSON.stringify(kris, null, 2)};

(async function migrate() {
  'use strict';

  const SITE = (() => {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(\\/(?:sites|teams|portals|personal)\\/[^/]+)/i);
    return match ? origin + match[1] : origin;
  })();

  const LIST = 'GRC_KRI_Master';
  console.group('%cGRC KRI Migration', 'font-weight:bold;font-size:14px');
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
  const spGet  = (url) => fetch(SITE + url, { headers: { Accept: 'application/json;odata=nometadata' }, credentials: 'include' });
  const spPost = (url, body, digest, extraHeaders = {}) => fetch(SITE + url, {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': digest,
      ...extraHeaders,
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  let digest = await getDigest();

  const exists = await spGet(\`/_api/web/lists/getbytitle('\${LIST}')\`);
  if (!exists.ok) {
    console.error('  ✗  List ' + LIST + ' does not exist on this site. Aborting.');
    console.groupEnd();
    return;
  }
  console.log('  ✓  List found');

  // ── Step 1: Delete all existing items ─────────────────────────────────────
  console.group('Step 1: Delete existing items');
  let pageUrl = \`/_api/web/lists/getbytitle('\${LIST}')/items?$select=ID&$top=2000\`;
  const existingIds = [];
  while (pageUrl) {
    const r = await spGet(pageUrl);
    if (!r.ok) break;
    const j = await r.json();
    (j.value || []).forEach(it => existingIds.push(it.ID));
    pageUrl = j['odata.nextLink'] ? j['odata.nextLink'].replace(SITE, '') : null;
  }
  console.log('  Found ' + existingIds.length + ' items to delete');
  for (const id of existingIds) {
    digest = await getDigest();
    const r = await spPost(
      \`/_api/web/lists/getbytitle('\${LIST}')/items(\${id})\`,
      null,
      digest,
      { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    );
    if (!r.ok) console.warn('    ⚠ failed to delete item ' + id);
  }
  console.log('  ✓ Cleared');
  console.groupEnd();

  // ── Step 2: Drop old Number threshold columns ─────────────────────────────
  console.group('Step 2: Drop old Number threshold columns');
  for (const col of ['GreenThreshold', 'AmberThreshold', 'RedThreshold']) {
    digest = await getDigest();
    const check = await spGet(\`/_api/web/lists/getbytitle('\${LIST}')/fields/getbyinternalnameortitle('\${col}')\`);
    if (!check.ok) { console.log('  ↩ ' + col + ' not present'); continue; }
    const info = await check.json();
    if (info.TypeAsString === 'Text' || info.TypeAsString === 'Note') {
      console.log('  ↩ ' + col + ' already Text — keeping');
      continue;
    }
    const r = await spPost(
      \`/_api/web/lists/getbytitle('\${LIST}')/fields/getbyinternalnameortitle('\${col}')\`,
      null,
      digest,
      { 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' }
    );
    if (r.ok) console.log('  ✓ Dropped ' + col);
    else console.warn('  ⚠ Could not drop ' + col);
  }
  console.groupEnd();

  // ── Step 3: Add new Text/Note columns ─────────────────────────────────────
  console.group('Step 3: Add new columns');
  const text = (Title) => ({ __metadata: { type: 'SP.FieldText'         }, FieldTypeKind: 2, Title, Required: false });
  const note = (Title) => ({ __metadata: { type: 'SP.FieldMultiLineText' }, FieldTypeKind: 3, Title, Required: false, RichText: false, AppendOnly: false });

  const newCols = [
    text('GreenThreshold'),
    text('AmberThreshold'),
    text('RedThreshold'),
    text('SubCategory'),
    text('RiskCategoryL1'),
    note('Metric'),
    note('BaseData'),
    text('DataSource'),
  ];
  for (const def of newCols) {
    digest = await getDigest();
    const check = await spGet(\`/_api/web/lists/getbytitle('\${LIST}')/fields/getbyinternalnameortitle('\${def.Title}')\`);
    if (check.ok) { console.log('  ↩ ' + def.Title + ' already exists'); continue; }
    const r = await spPost(\`/_api/web/lists/getbytitle('\${LIST}')/fields\`, def, digest);
    if (r.ok) console.log('  ✓ ' + def.Title);
    else {
      const t = await r.text();
      console.warn('  ⚠ ' + def.Title + ' — ' + t.slice(0, 150));
    }
  }
  console.groupEnd();

  // ── Step 4: Insert KRIs ───────────────────────────────────────────────────
  console.group('Step 4: Insert ' + KRIS.length + ' KRIs');
  let inserted = 0, failed = 0;
  for (const kri of KRIS) {
    digest = await getDigest();
    const body = { __metadata: { type: 'SP.Data.GRC_KRI_MasterListItem' }, ...kri };
    const r = await spPost(\`/_api/web/lists/getbytitle('\${LIST}')/items\`, body, digest);
    if (r.ok) {
      inserted++;
      if (inserted % 10 === 0) console.log('  ✓ ' + inserted + '/' + KRIS.length);
    } else {
      failed++;
      const t = await r.text();
      console.warn('  ⚠ ' + kri.KRIID + ' (' + kri.Title.slice(0, 50) + ') — ' + t.slice(0, 150));
    }
  }
  console.log('  Inserted: ' + inserted + ' / ' + KRIS.length);
  if (failed) console.warn('  Failed: ' + failed);
  console.groupEnd();

  console.log('%c✓ Migration complete', 'color:#16a34a;font-weight:bold');
  console.groupEnd();
})();
`;

fs.writeFileSync(path.join(__dirname, 'grc-kri-migration.js'), script);
console.log('Wrote scripts/grc-kri-migration.js (' + Buffer.byteLength(script) + ' bytes)');
