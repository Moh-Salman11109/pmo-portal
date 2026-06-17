// Scans the GRC historical KRI ZIP and produces a parsed readings dataset.
// Matches each row's KRI title against tree-kris.json (the 91 we imported to SP).
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const ROOT = 'C:/Users/nioh1/AppData/Local/Temp/grc-historical/Dashboard Historical Data (KRIs)';
const kris = require('./tree-kris.json');

// ── Helpers ───────────────────────────────────────────────────────
const norm = v => String(v ?? '').replace(/[­–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const titleKey = t => norm(t).replace(/[^\w\s%]/g, '');

// Build KRI lookup
const kriByTitle = new Map();
kris.forEach(k => kriByTitle.set(titleKey(k.Title), k));

// Parse quarter from filename
const parseQuarter = (fname) => {
  // Match: Q1-25, Q1-2025, Q1-26, Q1-2026, etc.
  const m = fname.match(/Q([1-4])[-_\s]*(\d{2,4})/i);
  if (!m) return null;
  const q = m[1];
  let y = m[2];
  if (y.length === 2) y = '20' + y;
  return `${y}-Q${q}`;
};

// Map header row to column indices
const mapColumns = (header) => {
  const idx = {};
  // First pass: explicit named columns
  header.forEach((h, i) => {
    const n = norm(h);
    if (n.includes('key risk indicator'))                idx.kri = i;
    else if (n.includes('actual results (current'))      idx.current = i;
    else if (n.includes('actual results (previous'))     idx.previous = i;
    else if (n === 'rag' || n === 'status' || n === 'internal status' || n.includes('rag status')) idx.rag = i;
    else if (n.startsWith('comments') || n === 'comment' || n === 'notes' || n === 'remarks') idx.comments = i;
    else if (n.includes('justification') || n.includes('explanation') || n === 'reason') idx.justification = i;
    else if (n === 'action plan' || (n.includes('action plan') && !n.includes('previous'))) idx.actionPlan = i;
  });
  // Fallback for RAG: if a column right after Current/Previous "Actual results" has Green/Amber/Red values
  // (handled later in row iteration as a per-cell heuristic)
  return idx;
};

// Detect RAG from a cell value
const detectRAG = (v) => {
  const n = norm(v);
  if (n.includes('green')) return 'Green';
  if (n.includes('amber') || n.includes('yellow')) return 'Amber';
  if (n.includes('red'))   return 'Red';
  return null;
};

// Format actual value (preserve % vs number)
const formatValue = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Heuristic: small decimals are likely percentages
    if (v > 0 && v < 1) return Math.round(v * 10000) / 100; // e.g. 0.0593 -> 5.93
    return v;
  }
  return String(v).trim();
};

// ── Walk the tree ─────────────────────────────────────────────────
const readings = [];
const unmatchedTitles = new Set();
const stats = { files: 0, rowsScanned: 0, readingsExtracted: 0, unmatched: 0, noQuarter: 0 };

const walk = (dir) => {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (!item.toLowerCase().endsWith('.xlsx')) return;

    stats.files++;
    const quarter = parseQuarter(item);
    if (!quarter) { stats.noQuarter++; return; }

    try {
      const wb = xlsx.readFile(full);
      wb.SheetNames.forEach(sname => {
        const ws = wb.Sheets[sname];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) return;
        const idx = mapColumns(rows[0]);
        if (idx.kri == null || idx.current == null) return;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const kriTitle = norm(row[idx.kri]);
          if (!kriTitle) continue;
          stats.rowsScanned++;

          const matched = kriByTitle.get(titleKey(row[idx.kri]));
          if (!matched) {
            unmatchedTitles.add(String(row[idx.kri]).trim());
            stats.unmatched++;
            continue;
          }

          const actualRaw = row[idx.current];
          // Try RAG from header-mapped column first; if missing, scan the cells right after the actual-results columns
          let rag = idx.rag != null ? detectRAG(row[idx.rag]) : null;
          if (!rag && idx.current != null) {
            for (let off = 1; off <= 4 && !rag; off++) {
              rag = detectRAG(row[idx.current + off]);
            }
          }
          if (actualRaw === '' || actualRaw === null) continue;

          readings.push({
            KRIID: matched.KRIID,
            KRITitle: matched.Title,
            BusinessUnit: matched.BusinessUnit,
            Period: quarter,
            ActualValue: formatValue(actualRaw),
            RAGStatus: rag,
            Comments:      idx.comments      != null ? String(row[idx.comments]      || '').trim() : '',
            Justification: idx.justification != null ? String(row[idx.justification] || '').trim() : '',
            ActionPlan:    idx.actionPlan    != null ? String(row[idx.actionPlan]    || '').trim() : '',
            sourceFile: path.relative(ROOT, full),
          });
          stats.readingsExtracted++;
        }
      });
    } catch (e) {
      console.warn('  ⚠ parse failed:', item, e.message);
    }
  });
};

walk(ROOT);

// ── Output ────────────────────────────────────────────────────────
const outDir = path.dirname(require.resolve('./tree-kris.json'));
fs.writeFileSync(path.join(outDir, 'historical-readings.json'), JSON.stringify(readings, null, 2));

console.log('═══ HISTORICAL READINGS ANALYSIS ═══');
console.log('Files scanned     :', stats.files);
console.log('Rows scanned      :', stats.rowsScanned);
console.log('Readings extracted:', stats.readingsExtracted);
console.log('Unmatched titles  :', stats.unmatched, '(' + unmatchedTitles.size + ' unique)');
console.log('Files w/o quarter :', stats.noQuarter);
console.log('');

// By quarter
const byQuarter = {};
readings.forEach(r => byQuarter[r.Period] = (byQuarter[r.Period] || 0) + 1);
console.log('By quarter:');
Object.keys(byQuarter).sort().forEach(q => console.log('  ' + q + ': ' + byQuarter[q]));
console.log('');

// By department
const byDept = {};
readings.forEach(r => byDept[r.BusinessUnit] = (byDept[r.BusinessUnit] || 0) + 1);
console.log('By dept:');
Object.keys(byDept).sort().forEach(d => console.log('  ' + d + ': ' + byDept[d]));
console.log('');

if (unmatchedTitles.size > 0) {
  console.log('Sample unmatched titles (' + Math.min(unmatchedTitles.size, 12) + ' of ' + unmatchedTitles.size + '):');
  Array.from(unmatchedTitles).slice(0, 12).forEach(t => console.log('  -', t.slice(0, 120)));
}
