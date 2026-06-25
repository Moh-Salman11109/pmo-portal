// ═══════════════════════════════════════════════════════════════════════════
//  PMO Portal — SharePoint Provisioning Script
//
//  HOW TO RUN
//  1. Open your SharePoint site in the browser and log in.
//  2. Open DevTools → Console  (F12 → Console tab).
//  3. Paste this entire script and press Enter.
//  4. Watch the log — green ✓ = created, ↩ = already existed, ✗ = error
//
//  SAFE TO RE-RUN: checks before creating; skips anything that already exists.
//
//  WHAT IT CREATES
//    List: PMO_Projects     — 52 columns (full project schema)
//    List: PMO_Departments  — 4 columns  (department reference)
// ═══════════════════════════════════════════════════════════════════════════

(async function provision() {
  'use strict';

  // ── Site URL ─────────────────────────────────────────────────────────────
  // Auto-detected from the current page. Override manually if needed:
  // const SITE = 'https://yourcompany.sharepoint.com/sites/pmo';
  const SITE = (() => {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(\/(?:sites|teams|portals|personal)\/[^/]+)/i);
    return match ? origin + match[1] : origin;
  })();

  console.group('%cPMO Portal — SharePoint Provisioning', 'font-weight:bold;font-size:14px');
  console.log('Target site:', SITE);
  console.log('');

  // ── Low-level helpers ─────────────────────────────────────────────────────

  async function getDigest() {
    const r = await fetch(`${SITE}/_api/contextinfo`, {
      method: 'POST',
      headers: { Accept: 'application/json;odata=nometadata' },
      credentials: 'include',
    });
    if (!r.ok) throw new Error('Cannot get request digest — are you logged into SharePoint?');
    const d = await r.json();
    return d.FormDigestValue;
  }

  async function spGet(url) {
    return fetch(`${SITE}${url}`, {
      headers: { Accept: 'application/json;odata=nometadata' },
      credentials: 'include',
    });
  }

  async function spPost(url, body, digest) {
    return fetch(`${SITE}${url}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  }

  // ── List helpers ──────────────────────────────────────────────────────────

  async function createList(name, digest) {
    const check = await spGet(`/_api/web/lists/getbytitle('${name}')`);
    if (check.ok) {
      console.log(`  ↩  List "${name}" already exists — skipping`);
      return;
    }
    const r = await spPost('/_api/web/lists', {
      __metadata: { type: 'SP.List' },
      AllowContentTypes: false,
      BaseTemplate: 100,
      ContentTypesEnabled: false,
      Description: '',
      Title: name,
    }, digest);
    if (!r.ok) throw new Error(`Failed to create list "${name}": ${await r.text()}`);
    console.log(`  ✓  Created list "${name}"`);
  }

  async function addField(listName, def, digest) {
    const name = def.Title;
    const check = await spGet(
      `/_api/web/lists/getbytitle('${listName}')/fields/getbyinternalnameortitle('${name}')`
    );
    if (check.ok) {
      console.log(`      ↩  "${name}"`);
      return;
    }
    const r = await spPost(
      `/_api/web/lists/getbytitle('${listName}')/fields`,
      def,
      digest
    );
    if (!r.ok) {
      const msg = await r.text();
      // Extract the readable error message from the ODATA error blob
      let reason = msg;
      try { reason = JSON.parse(msg)['odata.error'].message.value; } catch {}
      console.error(`      ✗  "${name}" — ${reason.slice(0, 200)}`);
      return;
    }
    console.log(`      ✓  "${name}"`);
  }

  // ── Field definition factories ────────────────────────────────────────────

  const text = (Title) => ({
    __metadata: { type: 'SP.FieldText' },
    FieldTypeKind: 2, Title, Required: false,
  });

  // Multi-line plain text — MUST have RichText:false for JSON columns
  const note = (Title) => ({
    __metadata: { type: 'SP.FieldMultiLineText' },
    FieldTypeKind: 3, Title, Required: false,
    RichText: false,
    AppendOnly: false,
    UnlimitedLengthInDocumentLibrary: true,
  });

  // Date only (no time component)
  const date = (Title) => ({
    __metadata: { type: 'SP.FieldDateTime' },
    FieldTypeKind: 4, Title, Required: false,
    DisplayFormat: 0,  // 0 = DateOnly
  });

  const choice = (Title, results, DefaultValue) => ({
    __metadata: { type: 'SP.FieldChoice' },
    FieldTypeKind: 6, Title, Required: false,
    Choices: { __metadata: { type: 'Collection(Edm.String)' }, results },
    ...(DefaultValue ? { DefaultValue } : {}),
  });

  const num = (Title, { decimal = 2, min, max } = {}) => ({
    __metadata: { type: 'SP.FieldNumber' },
    FieldTypeKind: 9, Title, Required: false,
    DecimalPlaces: decimal,
    ...(min !== undefined ? { MinimumValue: min } : {}),
    ...(max !== undefined ? { MaximumValue: max } : {}),
  });

  const bool = (Title, defaultOn = false) => ({
    __metadata: { type: 'SP.Field' },
    FieldTypeKind: 8, Title, Required: false,
    DefaultValue: defaultOn ? '1' : '0',
  });

  // ── PMO_Projects — field list ─────────────────────────────────────────────
  // Title column is built-in — do not re-create.

  const projectFields = [

    // ── Identity ───────────────────────────────────────────────────────
    text('ProjectID'),       // P001, P002 …
    text('ProjectCode'),     // STRAT-2025-001 …

    // ── Classification ─────────────────────────────────────────────────
    text('DepartmentID'),    // slug: strategy, digital …
    choice('ProjectType',
      ['Business Project', 'Enterprise Project', 'Internal Project'],
      'Internal Project'),
    choice('Phase',
      ['Initiation', 'Planning', 'Execution', 'Closure', 'Completed'],
      'Initiation'),
    choice('CurrentGate',
      ['Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5'],
      'Gate 1'),
    choice('Status',
      ['On Track', 'At Risk', 'Delayed', 'Completed', 'Not Started'],
      'Not Started'),
    choice('Priority',
      ['Critical', 'High', 'Medium', 'Low'],
      'Medium'),
    choice('Classification',
      ['Strategic Initiative', 'Strategic', 'Compliance', 'Transformation', 'Operational', 'Infrastructure']),
    choice('StrategicObjective',
      ['Digital Transformation', 'Corporate Strategy', 'Innovation & Technology',
       'Operational Excellence', 'Governance & Compliance', 'People & Culture',
       'Quality & Excellence', 'Performance Excellence']),
    choice('RiskLevel',
      ['Low', 'Medium', 'High', 'Critical'],
      'Low'),
    choice('BudgetStatus',
      ['On Budget', 'Over Budget', 'Under Budget'],
      'On Budget'),

    // ── People (text in Phase 2A; migrate to Person in Phase 2B) ───────
    text('ProjectManager'),
    text('Sponsor'),

    // ── Dates ──────────────────────────────────────────────────────────
    date('StartDate'),
    date('PlannedEndDate'),
    date('LastUpdate'),
    date('ArchivedDate'),

    // ── Performance ────────────────────────────────────────────────────
    num('Progress',        { decimal: 0, min: 0, max: 100 }),
    num('PlannedProgress', { decimal: 0, min: 0, max: 100 }),
    num('SPI',             { decimal: 2 }),   // no min/max — can exceed 1.0
    num('CPI',             { decimal: 2 }),
    num('DaysRemaining',   { decimal: 0, min: 0 }),
    num('DaysDelayed',     { decimal: 0, min: 0 }),
    text('ScheduleVariance'),                 // "+3 days" / "-18 days" / "On Time"

    // ── Financials (SAR — app handles formatting) ───────────────────────
    num('Budget',     { decimal: 0, min: 0 }),
    num('Forecast',   { decimal: 0, min: 0 }),
    num('ActualCost', { decimal: 0, min: 0 }),

    // ── Narrative ──────────────────────────────────────────────────────
    note('Objective'),
    note('BusinessCase'),

    // ── Lifecycle ──────────────────────────────────────────────────────
    bool('IsArchived', false),

    // ── PMO Governance ─────────────────────────────────────────────────
    choice('UpdateCadence',
      ['Weekly', 'Biweekly', 'Monthly', 'Custom'],
      'Biweekly'),
    date('NextUpdateDue'),
    date('LastValidatedUpdate'),
    choice('DataReliabilityFlag',
      ['Trusted', 'Pending', 'Stale'],
      'Pending'),
    choice('PMOStatus',
      ['Draft', 'Submitted', 'Validated', 'Returned', 'Escalated'],
      'Draft'),
    note('PMOValidationNote'),   // return reason from PMO — plain text
    text('PMOValidatedBy'),
    date('PMOValidatedDate'),
    text('LastSubmittedBy'),
    date('LastSubmittedDate'),

    // ── JSON Sub-Objects (ALL must be plain text — RichText: false) ─────
    note('GatesJSON'),
    note('MilestonesJSON'),
    note('RisksJSON'),
    note('IssuesJSON'),
    note('BenefitsJSON'),
    note('ApprovalsJSON'),
    note('DocumentsJSON'),
    note('UpdatesJSON'),
    note('HealthJSON'),
    note('RequiredDocsJSON'),
  ];

  // ── PMO_Departments — field list ──────────────────────────────────────────
  // Title column is built-in — do not re-create.

  const deptFields = [
    text('DeptID'),     // slug: strategy, digital …  must match DepartmentID in Projects
    text('DeptIcon'),   // emoji: ⚡ 💻 ⚙️ …
    text('DeptColor'),  // hex:   #003932 #0066cc …
  ];

  // ── Run ───────────────────────────────────────────────────────────────────

  let digest = await getDigest();

  // ── PMO_Projects ──
  console.group('Creating PMO_Projects');
  await createList('PMO_Projects', digest);
  digest = await getDigest();
  console.log('  Adding fields …');
  for (const f of projectFields) {
    await addField('PMO_Projects', f, digest);
  }
  console.groupEnd();

  console.log('');

  // ── PMO_Departments ──
  digest = await getDigest();
  console.group('Creating PMO_Departments');
  await createList('PMO_Departments', digest);
  digest = await getDigest();
  console.log('  Adding fields …');
  for (const f of deptFields) {
    await addField('PMO_Departments', f, digest);
  }
  console.groupEnd();

  console.log('');
  console.log('%c✅  Provisioning complete.', 'color:green;font-weight:bold');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify lists in SharePoint → Site Contents');
  console.log('  2. Add your .env file:');
  console.log('       VITE_USE_MOCK=false');
  console.log('       VITE_SP_SITE_URL=<this site URL>');
  console.log('  3. npm run dev — the MOCK badge should switch to SharePoint');
  console.groupEnd();

})().catch(err => {
  console.error('%c❌  Provisioning failed:', 'color:red;font-weight:bold', err.message);
  console.error('Check: are you logged in? Do you have site owner/admin rights?');
});
