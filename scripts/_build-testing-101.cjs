// Testing 101 — a gentle, illustrated intro for the user. Zero jargon assumed.
// 6 pages, A4 portrait, brand-matched. Run + open PDF in Downloads.
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Testing 101 — PMO Portal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --brand: #003932; --brand-2: #005c4b; --mint: #00b894; --mint-lt: #e6f9f5;
    --amber: #f59e0b; --amber-lt: #fffbeb;
    --red: #ef4444; --red-lt: #fef2f2;
    --blue: #3b82f6; --blue-lt: #eff6ff;
    --ink: #0d1f1c; --muted: #4b6c67; --border: #d1e8e4;
    --bg: #f5faf9;
  }
  body {
    font-family: 'Inter', sans-serif;
    background: #c8d8d5;
    color: var(--ink);
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 210mm; min-height: 297mm;
    background: white;
    margin: 10mm auto;
    box-shadow: 0 4px 40px rgba(0,57,50,0.14);
    display: flex; flex-direction: column;
  }
  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
  }
  @page { size: A4 portrait; margin: 0; }

  .head {
    background: var(--brand);
    padding: 10px 16mm;
    display: flex; align-items: center; gap: 10px;
  }
  .head .logo { background: var(--mint); color: var(--brand); font-weight: 900; font-size: 11px; padding: 3px 8px; border-radius: 4px; }
  .head .doc { color: rgba(255,255,255,0.6); font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }
  .head .pg { margin-left: auto; color: var(--mint); font-size: 10px; font-weight: 700; }

  .body { flex: 1; padding: 16mm 18mm; }
  .foot { background: var(--brand); height: 4mm; }

  /* COVER */
  .cover-body {
    background: linear-gradient(135deg, #003932 0%, #005c4b 50%, #007a62 100%);
    color: white;
    padding: 60mm 18mm 30mm;
    flex: 1;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; overflow: hidden;
  }
  .cover-body::before {
    content: '🧪';
    position: absolute;
    top: 25mm; right: 18mm;
    font-size: 100px;
    opacity: 0.18;
  }
  .cover-body .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,184,148,0.18);
    border: 1px solid rgba(0,184,148,0.35);
    border-radius: 22px;
    padding: 6px 16px;
    margin-bottom: 26px;
    align-self: flex-start;
  }
  .cover-body .badge .d { width: 7px; height: 7px; background: var(--mint); border-radius: 50%; }
  .cover-body .badge span { color: var(--mint); font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  .cover-body h1 { font-size: 50px; font-weight: 900; letter-spacing: -1.4px; line-height: 1.0; margin-bottom: 16px; }
  .cover-body h1 em { color: var(--mint); font-style: normal; }
  .cover-body .lead { color: rgba(255,255,255,0.75); font-size: 15px; line-height: 1.6; max-width: 75%; margin-bottom: 32px; }
  .cover-body .meta { display: flex; gap: 30px; }
  .cover-body .meta .l { font-size: 10px; color: rgba(0,184,148,0.7); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
  .cover-body .meta .v { font-size: 12px; color: white; font-weight: 600; }

  /* PAGE STYLES */
  .section-tag {
    display: inline-block;
    background: var(--mint-lt);
    color: var(--brand);
    border: 1px solid #a7f3d0;
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  h2.section {
    font-size: 26px;
    font-weight: 900;
    color: var(--brand);
    letter-spacing: -0.6px;
    line-height: 1.05;
    margin-bottom: 18px;
    border-bottom: 2px solid var(--mint);
    padding-bottom: 10px;
  }
  h2.section .ch {
    background: var(--brand);
    color: var(--mint);
    font-size: 12px;
    padding: 5px 11px;
    border-radius: 12px;
    margin-right: 12px;
    font-weight: 800;
    vertical-align: middle;
  }
  h3.sub {
    font-size: 15px;
    font-weight: 800;
    color: var(--brand);
    margin: 18px 0 10px;
  }
  p { font-size: 13px; color: var(--ink); line-height: 1.7; margin-bottom: 10px; }
  p.muted { color: var(--muted); }
  p .ar { direction: rtl; }

  /* BIG IDEA BOX */
  .idea {
    background: linear-gradient(135deg, var(--mint-lt) 0%, #d1f6ed 100%);
    border-left: 5px solid var(--mint);
    border-radius: 0 12px 12px 0;
    padding: 18px 22px;
    margin: 16px 0;
  }
  .idea .lbl { font-size: 11px; font-weight: 800; color: var(--brand); letter-spacing: 0.8px; margin-bottom: 8px; text-transform: uppercase; }
  .idea p { font-size: 13.5px; color: var(--ink); line-height: 1.7; margin-bottom: 0; font-weight: 500; }

  /* ANALOGY BOX */
  .analogy {
    background: var(--amber-lt);
    border: 2px dashed var(--amber);
    border-radius: 12px;
    padding: 16px 20px;
    margin: 14px 0;
    display: flex;
    gap: 14px;
  }
  .analogy .ic { font-size: 32px; flex-shrink: 0; }
  .analogy .t { flex: 1; }
  .analogy .t .h { font-size: 13px; font-weight: 800; color: #92400e; margin-bottom: 4px; }
  .analogy .t p { font-size: 12.5px; color: #78350f; line-height: 1.65; margin-bottom: 6px; }

  /* CODE BLOCK */
  pre.code {
    background: #0d1f1c;
    color: #d4f5e9;
    padding: 14px 18px;
    border-radius: 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.7;
    margin: 12px 0;
    overflow-x: auto;
  }
  pre.code .c { color: #64748b; font-style: italic; }
  pre.code .k { color: #fcd34d; font-weight: 600; }
  pre.code .s { color: #fda4af; }
  pre.code .n { color: #93c5fd; }
  pre.code .f { color: #5eead4; }

  /* SIDE-BY-SIDE */
  .sxs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0; }
  .sxs .col { background: var(--bg); border: 1.5px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .sxs .col.bad { border-color: #fecaca; background: var(--red-lt); }
  .sxs .col.good { border-color: #a7f3d0; background: var(--mint-lt); }
  .sxs .col .hd { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase; }
  .sxs .col.bad .hd { color: #991b1b; }
  .sxs .col.good .hd { color: var(--brand); }
  .sxs .col p { font-size: 12px; line-height: 1.55; margin-bottom: 6px; }
  .sxs .col p:last-child { margin-bottom: 0; }

  /* ANNOTATED LINE */
  .annotated {
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    margin: 14px 0;
  }
  .annotated .line {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 16px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--border);
  }
  .annotated .line:last-child { border-bottom: none; }
  .annotated .line code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
    background: var(--brand);
    color: var(--mint);
    padding: 4px 9px;
    border-radius: 5px;
    font-weight: 600;
  }
  .annotated .line .meaning {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.55;
    direction: rtl;
    text-align: right;
  }
  .annotated .line .meaning strong { color: var(--brand); font-weight: 700; }

  /* TERMINAL */
  .terminal {
    background: #0d1f1c;
    border-radius: 12px;
    overflow: hidden;
    margin: 14px 0;
    box-shadow: 0 6px 20px rgba(0,57,50,0.2);
  }
  .terminal .bar { background: #1a3530; padding: 8px 14px; display: flex; gap: 6px; align-items: center; }
  .terminal .bar .d { width: 9px; height: 9px; border-radius: 50%; background: #4b6c67; }
  .terminal .bar .d.r { background: #ef4444; }
  .terminal .bar .d.y { background: #f59e0b; }
  .terminal .bar .d.g { background: #10b981; }
  .terminal .bar .t { margin-left: 10px; font-size: 10px; color: rgba(255,255,255,0.5); font-family: 'JetBrains Mono', monospace; }
  .terminal .out {
    padding: 14px 18px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.7;
    color: #d4f5e9;
  }
  .terminal .out .c { color: #94a3b8; }
  .terminal .out .g { color: #10b981; font-weight: 700; }
  .terminal .out .r { color: #ef4444; font-weight: 700; }
  .terminal .out .b { color: white; font-weight: 700; }

  /* TABLE */
  table.t {
    width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0;
  }
  table.t th {
    background: var(--brand);
    color: white;
    padding: 9px 12px;
    text-align: left;
    font-size: 10.5px;
    font-weight: 700;
  }
  table.t th:first-child { border-radius: 6px 0 0 0; }
  table.t th:last-child  { border-radius: 0 6px 0 0; }
  table.t td {
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    line-height: 1.45;
  }
  table.t tr:nth-child(even) td { background: var(--bg); }
  table.t td.k { font-weight: 700; color: var(--brand); }

  /* DO/DONT */
  .check { color: #16a34a; font-weight: 800; }
  .cross { color: #dc2626; font-weight: 800; }

  /* FRIENDLY EMOJI BULLETS */
  ul.fr { list-style: none; padding: 0; margin: 10px 0; }
  ul.fr li { font-size: 13px; color: var(--ink); line-height: 1.7; padding-left: 26px; position: relative; margin-bottom: 6px; }
  ul.fr li::before { content: attr(data-i); position: absolute; left: 0; top: 0; font-size: 14px; }

  /* GLOSSARY */
  .glossary {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 14px 18px;
    margin-top: 14px;
  }
  .glossary .row { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 12px; }
  .glossary .row:last-child { border-bottom: none; }
  .glossary .row .term { font-weight: 800; color: var(--brand); }
  .glossary .row .def { color: var(--muted); line-height: 1.5; }
</style>
</head>
<body>

<!-- ════════════ COVER ════════════ -->
<div class="page">
  <div class="cover-body">
    <div class="badge"><div class="d"></div><span>Beginner-friendly guide</span></div>
    <h1>Testing<br>made<br><em>simple</em>.</h1>
    <div class="lead">A 6-page walk-through of what tests are, why we wrote them, and how to read and run the ones already in the PMO Portal — no coding background needed.</div>
    <div class="meta">
      <div><div class="l">Audience</div><div class="v">You · the Product Owner</div></div>
      <div><div class="l">Reading time</div><div class="v">15 minutes</div></div>
      <div><div class="l">Tests in repo</div><div class="v">23 cases · vitest</div></div>
    </div>
  </div>
</div>

<!-- ════════════ 1 — WHAT IS A TEST ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Testing 101</div><div class="pg">2</div></div>
  <div class="body">
    <div class="section-tag">Chapter 1</div>
    <h2 class="section"><span class="ch">01</span>What is a test, really?</h2>

    <p>A test is a small piece of code that <strong>asks the application a question</strong> and checks whether the answer is right. That's it. The computer reads it, runs it, and either says ✅ "yes, still correct" or ❌ "no, something broke".</p>

    <div class="analogy">
      <div class="ic">🧮</div>
      <div class="t">
        <div class="h">Think of a tireless junior accountant</div>
        <p>Imagine an accountant who, every single time you change one number in a giant spreadsheet, re-checks every formula in every cell. He never gets tired, never misses anything, and finishes in half a second. <strong>A test suite is exactly that.</strong></p>
      </div>
    </div>

    <h3 class="sub">Why we wrote them</h3>
    <p>Until this week the PMO Portal had zero tests. That meant every code change carried a small risk: change one calculation, accidentally break another. With 23 tests now in place, the moment any change accidentally breaks the IPI math, MCI rules, or status derivation — the computer screams at us BEFORE the bug ships to the live portal.</p>

    <div class="sxs">
      <div class="col bad">
        <div class="hd">❌ Without tests</div>
        <p>Change the IPI formula.</p>
        <p>Hope it didn't break the Department rollup.</p>
        <p>Find out three weeks later when a regulator notices a wrong number.</p>
      </div>
      <div class="col good">
        <div class="hd">✅ With tests</div>
        <p>Change the IPI formula.</p>
        <p>Run <code>npm test</code> — 0.3 seconds.</p>
        <p>Computer says "23 passed" or shows exactly which case broke.</p>
      </div>
    </div>

    <div class="idea">
      <div class="lbl">💡 The one-line definition</div>
      <p>A test = a written question whose answer the computer can re-check, automatically, every time we change the code.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 2 — ANATOMY OF A TEST ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Testing 101</div><div class="pg">3</div></div>
  <div class="body">
    <div class="section-tag">Chapter 2</div>
    <h2 class="section"><span class="ch">02</span>The anatomy of one test</h2>
    <p>Here is one of the 23 tests we wrote, copied straight from <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--brand);">src/utils/metrics.test.js</code>. Don't worry about the symbols — we'll unpack each line.</p>

    <pre class="code"><span class="f">it</span>(<span class="s">"returns Completed when progress=100 and project is at Gate 5"</span>, () =&gt; {
  <span class="k">const</span> p = <span class="f">mk</span>({
    gate: <span class="s">"Gate 5"</span>,
    progress: <span class="n">100</span>,
    milestones: [{ id: <span class="s">"M1"</span>, progress: <span class="n">100</span>, status: <span class="s">"Completed"</span> }],
  });
  <span class="f">expect</span>(<span class="f">deriveProjectStatus</span>(p).status).<span class="f">toBe</span>(<span class="s">"Completed"</span>);
});</pre>

    <h3 class="sub">Line-by-line, in plain words</h3>
    <div class="annotated">
      <div class="line">
        <code>it("returns Completed when...")</code>
        <div class="meaning">"<strong>أتوقّع</strong> الآتي: لما يكون التقدّم 100% والمشروع في Gate 5 — الحالة المحسوبة لازم تكون Completed."</div>
      </div>
      <div class="line">
        <code>const p = mk({...})</code>
        <div class="meaning">"<strong>تخيّل</strong> أن عندنا مشروعاً وهميّاً بهذه المواصفات." (<code style="background:transparent;color:var(--brand);padding:0">mk</code> = make، يصنع مشروعاً مزيّفاً للاختبار فقط)</div>
      </div>
      <div class="line">
        <code>deriveProjectStatus(p)</code>
        <div class="meaning">"<strong>طبّق</strong> الدالة الحقيقية اللي بنيناها على هذا المشروع المزيّف."</div>
      </div>
      <div class="line">
        <code>expect(...).toBe("Completed")</code>
        <div class="meaning">"<strong>أتوقع</strong> الناتج يساوي 'Completed' بالضبط. إذا طلع غير ذلك، أعلن فشل الاختبار."</div>
      </div>
    </div>

    <div class="idea">
      <div class="lbl">💡 الفكرة الأساسية</div>
      <p>كل test يتكوّن من 3 أجزاء فقط: (1) جملة بالإنجليزي تشرح اللي نتوقّع، (2) إعداد بيانات مزيّفة، (3) جملة <code style="background:transparent;color:var(--brand);padding:0">expect(...).toBe(...)</code> تتحقّق من الإجابة.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 3 — HOW TO RUN ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Testing 101</div><div class="pg">4</div></div>
  <div class="body">
    <div class="section-tag">Chapter 3</div>
    <h2 class="section"><span class="ch">03</span>How to run the tests</h2>
    <p>Open the project folder in your terminal, then type a single command.</p>

    <h3 class="sub">The command — one of two flavours</h3>
    <table class="t">
      <thead><tr><th>Command</th><th>What it does</th></tr></thead>
      <tbody>
        <tr><td class="k"><code style="background:transparent;color:var(--brand);padding:0;font-weight:700">npm test</code></td><td>Runs all 23 tests once and prints the result. This is what we'll use 99% of the time.</td></tr>
        <tr><td class="k"><code style="background:transparent;color:var(--brand);padding:0;font-weight:700">npm run test:watch</code></td><td>Same, but stays running and re-runs tests automatically every time we save a file. Useful while making changes.</td></tr>
      </tbody>
    </table>

    <h3 class="sub">What success looks like</h3>
    <div class="terminal">
      <div class="bar"><div class="d r"></div><div class="d y"></div><div class="d g"></div><div class="t">terminal · success</div></div>
      <div class="out">
&gt; pmo-portal@1.0.0 test<br>
&gt; vitest run<br><br>
 <span class="c">RUN  v4.1.9 pmo-portal-clone</span><br><br>
 <span class="b">Test Files</span>  <span class="g">1 passed</span> (1)<br>
      <span class="b">Tests</span>  <span class="g">23 passed</span> (23)<br>
   <span class="b">Start at</span>  21:34:12<br>
   <span class="b">Duration</span>  439ms
      </div>
    </div>
    <p style="font-size:11.5px; color:var(--muted); margin-top:-4px;">Green numbers = everything works. We can change code and ship with confidence.</p>

    <h3 class="sub">What failure looks like</h3>
    <div class="terminal">
      <div class="bar"><div class="d r"></div><div class="d y"></div><div class="d g"></div><div class="t">terminal · failure</div></div>
      <div class="out">
 <span class="b">Test Files</span>  <span class="r">1 failed</span> (1)<br>
      <span class="b">Tests</span>  <span class="r">1 failed</span> | <span class="g">22 passed</span> (23)<br><br>
 <span class="r">FAIL</span>  src/utils/metrics.test.js &gt; MCI &gt; excludes future-gate docs<br>
   AssertionError: expected 0.5 to be 1.0<br>
   <span class="c">— Expected: 1.0</span><br>
   <span class="c">+ Received: 0.5</span>
      </div>
    </div>
    <p style="font-size:11.5px; color:var(--muted); margin-top:-4px;">Red = the computer is telling you exactly which test broke, and what value it got versus what it expected. You don't need to debug — the message tells you where to look.</p>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 4 — WHEN TO ADD ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Testing 101</div><div class="pg">5</div></div>
  <div class="body">
    <div class="section-tag">Chapter 4</div>
    <h2 class="section"><span class="ch">04</span>When do we add a new test?</h2>
    <p>You're not expected to write tests yourself — that's my job. But knowing <strong>when</strong> a test should be added helps you ask the right question: <em>"did we test that change?"</em></p>

    <ul class="fr">
      <li data-i="🐛"><strong>Right after fixing a bug.</strong> Today's IPI consistency bug (78 vs 82) — we wrote a test to make sure no future change brings that back.</li>
      <li data-i="📐"><strong>When the math changes.</strong> The gate-aware MCI rewrite added 7 tests, one per scenario, so we'd know immediately if any case broke.</li>
      <li data-i="📜"><strong>When PMO defines a new rule.</strong> "Closure is required at Gate 5" became a test. Now even if someone removes that default by accident, the test screams.</li>
      <li data-i="🎯"><strong>When a number is critical.</strong> Anything the regulator might look at — IPI, MCI, status thresholds — gets tested. UI cosmetics don't.</li>
    </ul>

    <h3 class="sub">When NOT to add a test</h3>
    <ul class="fr">
      <li data-i="🎨"><strong>Visual style:</strong> "the button is mint green" — no test. If it changes, you'll see it.</li>
      <li data-i="🔘"><strong>Trivial UI:</strong> "this modal closes when you click X" — no test. Manual click takes 2 seconds.</li>
      <li data-i="📝"><strong>Text labels:</strong> "the page title says PMO Portal" — no test. Pointless coverage.</li>
    </ul>

    <div class="idea">
      <div class="lbl">💡 القاعدة الذهبية</div>
      <p>اختبر <strong>الحسابات والقواعد</strong>، مش الـ UI. الحسابات لو طلعت غلط على الـ Regulator = كارثة. الـ UI لو طلع شكله غريب = نشوفه ونعدّله.</p>
    </div>

    <h3 class="sub">A typical conversation between us</h3>
    <table class="t">
      <thead><tr><th>You ask</th><th>I do</th></tr></thead>
      <tbody>
        <tr><td>"Fix this bug in the IPI"</td><td>Fix the code + add 1 test that locks the fix in</td></tr>
        <tr><td>"Change the MCI rule"</td><td>Change the code + add 2-3 tests for the new behavior</td></tr>
        <tr><td>"Make this button blue"</td><td>Change the colour. No test.</td></tr>
        <tr><td>"Add a new dashboard"</td><td>Build the UI + add tests for any new <em>calculation</em> it relies on</td></tr>
      </tbody>
    </table>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 5 — WHAT WE HAVE TODAY ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Testing 101</div><div class="pg">6</div></div>
  <div class="body">
    <div class="section-tag">Chapter 5</div>
    <h2 class="section"><span class="ch">05</span>The 23 tests we have today</h2>
    <p>All 23 tests live in one file: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--brand);">src/utils/metrics.test.js</code>. They're grouped into 5 sections (each section is a <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--brand);">describe</code> block).</p>

    <table class="t">
      <thead><tr><th>Section</th><th># cases</th><th>What it locks in</th></tr></thead>
      <tbody>
        <tr><td class="k">parseGateNumber</td><td>5</td><td>"Gate 4" → 4, "G3" → 3, garbage → 1, out-of-range clamped to [1,5]</td></tr>
        <tr><td class="k">MCI gate-aware</td><td>7</td><td>Closure at Gate 5 doesn't count until Gate 5; legacy docs default to Gate 1; tiered credit (1.0 / 0.5 / 0); null cases</td></tr>
        <tr><td class="k">Anticipated MCI</td><td>4</td><td>"What will MCI be at the next gate?" — handles already-at-Gate-5, no-change, drop forecast, full-credit forecast</td></tr>
        <tr><td class="k">Project Status</td><td>6</td><td>Completed only at 100% + Gate 5, Delayed past plannedEnd, Not Started with no activities, On Track ≥ 90 IPI, At Risk &lt; 90, every result has a reason</td></tr>
        <tr><td class="k">IPI consistency</td><td>1</td><td>The math the user sees in the header (IPI = 0.5·SPI + 0.25·CPI + 0.25·MCI) always matches the displayed number — the bug fix from earlier today, locked in forever.</td></tr>
      </tbody>
    </table>

    <h3 class="sub">What this gives you</h3>
    <p>Every time we change anything in <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--brand);">metrics.js</code> — the heart of the portal — these 23 tests run automatically. If any one of them breaks, we know within half a second, BEFORE pushing to production. That's the safety net you didn't have until this week.</p>

    <div class="idea">
      <div class="lbl">🎯 Try it yourself</div>
      <p>Open a terminal in the project folder, type <code style="background:transparent;color:var(--brand);padding:0;font-family:'JetBrains Mono',monospace">npm test</code>, hit Enter. You should see the green "23 passed" message in under a second. Now you can say with confidence: the math is intact.</p>
    </div>

    <h3 class="sub">Glossary — the words you'll hear</h3>
    <div class="glossary">
      <div class="row"><div class="term">test</div><div class="def">اختبار — قطعة كود تتأكد من إن دالة معيّنة ترجع الإجابة الصحيحة</div></div>
      <div class="row"><div class="term">vitest</div><div class="def">اسم الأداة اللي تشغّل الـ tests عندنا. سريعة، مدمجة مع Vite اللي يبني المشروع</div></div>
      <div class="row"><div class="term">describe / it</div><div class="def">كلمات لتقسيم الـ tests — describe = "هذه مجموعة عن X"، it = "أتوقّع كذا"</div></div>
      <div class="row"><div class="term">expect / toBe</div><div class="def">جملة التحقق — "أتوقع هذا يساوي ذاك"</div></div>
      <div class="row"><div class="term">pass / fail</div><div class="def">نجح / فشل — نتيجة كل اختبار</div></div>
      <div class="row"><div class="term">assertion</div><div class="def">ادّعاء — كل عبارة <code style="background:transparent;color:var(--brand);padding:0;font-family:'JetBrains Mono',monospace">expect()</code> تُعتبر assertion</div></div>
    </div>
  </div>
  <div class="foot"></div>
</div>

</body>
</html>`;

const outPath = path.join(__dirname, '..', '..', 'PMO-Portal-Testing-101.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath, '·', html.length, 'bytes');
