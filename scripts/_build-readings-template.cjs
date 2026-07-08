// Builds a starter Excel template for bulk-importing KRI readings.
// 91 KRIs × 6 monthly periods = 546 rows, pre-populated with KRIID / Title / Period.
// User fills ActualValue (required) and optionally RAGStatus / Comments.
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const kris = require('./tree-kris.json');

// Build 6 months back from current month (2026-06 → 2026-01..2026-06)
const now = new Date();
const periods = [];
for (let i = 5; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  periods.push(`${y}-${m}`);
}

const rows = [
  ['KRIID', 'KRI Title', 'Department', 'Period', 'ActualValue', 'RAGStatus', 'Comments'],
];
kris.forEach(k => {
  periods.forEach(p => {
    rows.push([k.KRIID, k.Title, k.BusinessUnit, p, '', '', '']);
  });
});

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet(rows);
// Set column widths
ws['!cols'] = [
  { wch: 10 },  // KRIID
  { wch: 60 },  // Title
  { wch: 14 },  // Department
  { wch: 10 },  // Period
  { wch: 14 },  // ActualValue
  { wch: 12 },  // RAGStatus
  { wch: 30 },  // Comments
];
xlsx.utils.book_append_sheet(wb, ws, 'KRI Readings');

const outPath = path.join(__dirname, '..', '..', 'Tree KRI Readings Template.xlsx');
xlsx.writeFile(wb, outPath);
console.log('Wrote:', outPath);
console.log('Rows:', rows.length - 1, '(91 KRIs × 6 periods)');
console.log('Periods covered:', periods.join(', '));
