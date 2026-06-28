import { calcProjectIPIFull } from '../src/utils/metrics.js';

const scenarios = [
  // SCHEDULE BASIC
  { n:'01. Not started (as-of before start)',         startDate:'2026-08-01', plannedEnd:'2026-12-01', progress:0,   asOf:'2026-07-01' },
  { n:'02. As-of = start exactly',                    startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:0,   asOf:'2026-04-04' },
  { n:'03. Halfway, 50% (on schedule)',               startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50,  asOf:'2026-06-01' },
  { n:'04. Halfway, 70% (ahead)',                     startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:70,  asOf:'2026-06-01' },
  { n:'05. Halfway, 30% (behind)',                    startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:30,  asOf:'2026-06-01' },

  // COMPLETION
  { n:'06. Finished well before plan',                startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:100, asOf:'2026-06-15' },
  { n:'07. Finished exactly on plan',                 startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:100, asOf:'2026-07-30' },
  { n:'08. Finished late (no roadmap)',               startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:100, asOf:'2026-09-15' },
  { n:'09. At planned end, 99% progress',             startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:99,  asOf:'2026-07-30' },

  // ROADMAP PENALTY
  { n:'10. Roadmap tight, day before',                startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-06-30', progress:100, asOf:'2026-06-29' },
  { n:'11. Roadmap tight, on the day',                startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-06-30', progress:100, asOf:'2026-06-30' },
  { n:'12. Roadmap tight, 1 day late',                startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-06-30', progress:100, asOf:'2026-07-01' },
  { n:'13. Roadmap tight, 36d late',                  startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-06-30', progress:100, asOf:'2026-08-05' },
  { n:'14. Roadmap = planned end, 6d late',           startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-07-30', progress:100, asOf:'2026-08-05' },
  { n:'15. Roadmap loose, past plan',                 startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-08-30', progress:100, asOf:'2026-08-15' },
  { n:'16. Way past roadmap (penalty=0)',             startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-06-30', progress:100, asOf:'2026-12-01' },

  // PLANNED PROGRESS OVERRIDE
  { n:'17. Planned=80, Actual=80 (SPI=1)',            startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:80, plannedProgress:80, asOf:'2026-06-29' },
  { n:'18. Planned=95, Actual=80 (behind roadmap)',   startDate:'2026-04-04', plannedEnd:'2026-07-30', roadmapDeadline:'2026-06-30', progress:80, plannedProgress:95, asOf:'2026-06-29' },
  { n:'19. Planned=50, Actual=80 (ahead)',            startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:80, plannedProgress:50, asOf:'2026-06-29' },
  { n:'20. Planned=0 (edge case)',                    startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, plannedProgress:0,  asOf:'2026-06-29' },
  { n:'21. Actual=0, Planned=50',                     startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:0,  plannedProgress:50, asOf:'2026-06-29' },
  { n:'22. Both 0',                                   startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:0,  plannedProgress:0,  asOf:'2026-06-29' },

  // COST / CPI
  { n:'23. Cost on budget exactly',                   startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, budget:1000000, actualCost:500000, asOf:'2026-06-01' },
  { n:'24. Under budget (CPI > 1)',                   startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, budget:1000000, actualCost:300000, asOf:'2026-06-01' },
  { n:'25. Over budget by 50%',                       startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, budget:1000000, actualCost:750000, asOf:'2026-06-01' },
  { n:'26. Spent all, only 10% done',                 startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:10, budget:1000000, actualCost:1000000, asOf:'2026-06-01' },
  { n:'27. No budget, has cost (CPI null)',           startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, budget:0,       actualCost:100000, asOf:'2026-06-01' },
  { n:'28. Budget but no cost (CPI null)',            startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, budget:1000000, actualCost:0,      asOf:'2026-06-01' },

  // MCI / DOCS
  { n:'29. All docs approved at G4',                  startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, asOf:'2026-06-01', gate:'Gate 4',
    documents:[{required:true,requiredAtGate:2,status:'Approved'},{required:true,requiredAtGate:4,status:'Approved'}] },
  { n:'30. Half docs approved at G4',                 startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, asOf:'2026-06-01', gate:'Gate 4',
    documents:[{required:true,requiredAtGate:2,status:'Approved'},{required:true,requiredAtGate:4,status:'Pending'}] },
  { n:'31. Future-gate doc excluded',                 startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:50, asOf:'2026-06-01', gate:'Gate 2',
    documents:[{required:true,requiredAtGate:2,status:'Approved'},{required:true,requiredAtGate:5,status:'Pending'}] },

  // ALL THREE
  { n:'32. Healthy across all 3',                     startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:60, asOf:'2026-06-01', budget:1000000, actualCost:500000, gate:'Gate 4',
    documents:[{required:true,requiredAtGate:2,status:'Approved'},{required:true,requiredAtGate:4,status:'Approved'}] },
  { n:'33. All 3 bad',                                startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:20, asOf:'2026-06-01', budget:1000000, actualCost:900000, gate:'Gate 4',
    documents:[{required:true,requiredAtGate:2,status:'Pending'},{required:true,requiredAtGate:4,status:'Pending'}] },

  // PATHOLOGICAL
  { n:'34. plannedEnd BEFORE startDate',              startDate:'2026-07-30', plannedEnd:'2026-04-04', progress:50, asOf:'2026-06-01' },
  { n:'35. plannedEnd = startDate',                   startDate:'2026-04-04', plannedEnd:'2026-04-04', progress:50, asOf:'2026-04-04' },
  { n:'36. Progress = 200 (out of bounds)',           startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:200, asOf:'2026-06-01' },
  { n:'37. Progress = -10 (negative)',                startDate:'2026-04-04', plannedEnd:'2026-07-30', progress:-10, asOf:'2026-06-01' },
  { n:'38. No dates at all',                          progress:50, asOf:'2026-06-01' },
];

const fmt = (n) => n == null ? '—' : (typeof n === 'number' ? n.toFixed(3) : n);
const pad = (s, w) => String(s).padStart(w);
const padE = (s, w) => String(s).padEnd(w);

console.log('IDX  IPI  STATUS         SPI    PEN    SPIxP   CPI    MCI    EV    PV    | SCENARIO');
console.log('─'.repeat(140));

for (const s of scenarios) {
  const { n, asOf, ...input } = s;
  const r = calcProjectIPIFull(input, asOf);
  const idx = n.split('.')[0];
  console.log(
    pad(idx, 3) + '  ' +
    pad(r.ipi ?? '—', 4) + ' ' +
    padE(r.status || '', 14) + ' ' +
    pad(fmt(r.components.spi), 6) + ' ' +
    pad(fmt(r.components.penalty), 6) + ' ' +
    pad(fmt(r.components.spiFinal), 6) + '  ' +
    pad(fmt(r.components.cpi), 6) + ' ' +
    pad(fmt(r.components.mci), 6) + ' ' +
    pad(fmt(r.ev), 5) + ' ' +
    pad(fmt(r.pv), 5) + ' | ' + n
  );
}
