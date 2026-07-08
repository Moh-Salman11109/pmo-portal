// Personal IPI explainer for Mohammed — student-friendly.
// English terms with a glossary at the top. No code blocks.
// Every example is a real Calculator input set the user can plug in
// and verify the number themselves.

const fs  = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>IPI — دليل شخصي</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  :root {
    --ink: #0d1f1c; --ink-2:#2c3e3a; --muted:#5a7770;
    --line:#d1e8e4; --soft:#ecf2ed;
    --brand:#003932; --sea:#00b894; --sea-bright:#00FFB3;
    --amber:#d97706; --amber-soft:#fef3c7;
    --red:#b91c1c; --red-soft:#fee2e2;
    --green:#15803d; --green-soft:#dcfce7;
    --blue:#1e40af; --blue-soft:#dbeafe;
  }
  body {
    font-family: 'Cairo', system-ui, sans-serif;
    background: #1a1a1a; color: var(--ink);
    line-height: 1.85;
  }
  .page {
    width: 210mm; min-height: 297mm;
    background: #fff;
    margin: 8mm auto;
    padding: 18mm 18mm 16mm;
    box-shadow: 0 10px 40px rgba(0,0,0,0.35);
    page-break-after: always;
    display: flex; flex-direction: column;
  }
  .page:last-child { page-break-after: avoid; }
  @media print {
    body { background:#fff; }
    .page { margin:0; box-shadow:none; }
    @page { size: A4; margin: 0; }
  }

  /* English terms render in Inter (cleaner Latin) */
  .en, .en * { font-family: 'Inter', system-ui, sans-serif !important; direction: ltr; unicode-bidi: embed; }

  /* COVER */
  .cover { background: linear-gradient(135deg, #001f1a 0%, #003932 60%, #006b56 100%); color:#fff; padding:0; }
  .cover-body { padding:40mm 22mm 28mm; flex:1; display:flex; flex-direction:column; justify-content:space-between; }
  .cover-tag { display:inline-block; padding:6px 16px; background:rgba(0,255,179,0.18); border:1px solid rgba(0,255,179,0.4); color:var(--sea-bright); border-radius:999px; font-size:10pt; font-weight:700; }
  .cover h1 { font-size:38pt; font-weight:900; line-height:1.15; margin-top:24px; color:#fff; }
  .cover h1 em { color: var(--sea-bright); font-style:normal; }
  .cover .sub { color: rgba(255,255,255,0.72); font-size:13pt; margin-top:18px; line-height:1.7; max-width:80%; }
  .cover .footer-block { border-top:1px solid rgba(255,255,255,0.15); padding-top:18px; display:grid; grid-template-columns:1fr 1fr; gap:18px; font-size:9pt; }
  .cover .footer-block .l { color:rgba(0,255,179,0.7); font-weight:700; text-transform:uppercase; font-size:8.5pt; margin-bottom:4px; }
  .cover .footer-block .v { color:#fff; font-size:10pt; line-height:1.6; }

  .ph { border-bottom: 2px solid var(--sea); padding-bottom:8px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:baseline; }
  .ph .t { font-size:9pt; color:var(--muted); font-weight:600; }
  .ph .n { font-size:8.5pt; color:var(--brand); font-weight:700; }

  h2.sec {
    font-size:22pt; font-weight:900; color: var(--brand);
    line-height:1.2; margin-bottom:6px;
    border-right: 5px solid var(--sea); padding-right:16px;
  }
  .sec-sub { font-size:11pt; color:var(--muted); margin-bottom:18px; }

  h3 { font-size:14pt; font-weight:800; color: var(--brand); margin: 18px 0 8px; }
  h4 { font-size:12pt; font-weight:700; color: var(--ink-2); margin: 14px 0 6px; }

  p { font-size:11pt; color: var(--ink-2); margin-bottom:10px; line-height:1.95; }
  p strong { color: var(--brand); font-weight:700; }
  ul { padding-right:24px; }
  ul li { font-size:11pt; line-height:2; color:var(--ink-2); }

  .callout {
    background: var(--soft); border-right: 4px solid var(--sea);
    padding: 12px 16px; border-radius: 8px; margin: 12px 0;
  }
  .callout.amber { background: var(--amber-soft); border-color: var(--amber); }
  .callout.red   { background: var(--red-soft);   border-color: var(--red); }
  .callout.green { background: var(--green-soft); border-color: var(--green); }
  .callout.blue  { background: var(--blue-soft);  border-color: var(--blue); }
  .callout h5 { font-size:10pt; font-weight:800; text-transform:uppercase; margin-bottom:4px; letter-spacing:0.3px; }
  .callout.amber h5 { color: var(--amber); }
  .callout.red h5 { color: var(--red); }
  .callout.green h5 { color: var(--green); }
  .callout.blue h5 { color: var(--blue); }
  .callout p { font-size:10.5pt; margin:0; }

  /* Math line: clean LTR display for arithmetic */
  .math {
    background: #f7fbf9;
    border: 1px solid var(--line);
    border-right: 4px solid var(--sea);
    border-radius: 8px;
    padding: 10px 14px;
    margin: 8px 0;
    font-family: 'Inter', sans-serif;
    font-size: 11pt; line-height: 1.9;
    direction: ltr; text-align: left;
    color: var(--ink);
  }
  .math .row { display: block; }
  .math .res { color: var(--brand); font-weight: 800; }
  .math .lbl { color: var(--muted); font-size: 10pt; }

  /* Calculator-input box — what to type into the IPI Calculator */
  .calc {
    background: #fff;
    border: 2px solid var(--brand);
    border-radius: 10px;
    padding: 14px 18px;
    margin: 14px 0;
  }
  .calc .calc-h {
    background: var(--brand); color: #fff;
    margin: -14px -18px 12px;
    padding: 8px 18px;
    border-radius: 8px 8px 0 0;
    font-family: 'Inter', sans-serif;
    font-size: 10pt; font-weight: 700; letter-spacing: 0.4px;
    text-transform: uppercase;
    display: flex; justify-content: space-between;
  }
  .calc table { width: 100%; }
  .calc td { padding: 4px 8px; font-size: 10.5pt; border-bottom: 1px dashed var(--line); }
  .calc td:first-child { color: var(--muted); width: 60%; }
  .calc td:last-child { font-family: 'Inter', sans-serif; font-weight: 700; color: var(--ink); text-align: left; direction: ltr; }
  .calc tr:last-child td { border-bottom: 0; }

  /* The expected output banner */
  .expect {
    background: linear-gradient(135deg, #003932, #001f1a);
    color: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    margin: 8px 0 14px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .expect .l { font-size: 9.5pt; color: var(--sea-bright); text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; }
  .expect .v { font-family: 'Inter', sans-serif; font-size: 18pt; font-weight: 900; color: #fff; }

  table.t { width:100%; border-collapse:collapse; margin: 10px 0; font-size:10pt; }
  table.t thead th { background: var(--brand); color:#fff; padding: 8px 12px; font-weight:700; text-align:right; }
  table.t thead th:first-child { border-radius: 0 6px 0 0; }
  table.t thead th:last-child { border-radius: 6px 0 0 0; }
  table.t tbody td { padding: 8px 12px; border-bottom: 1px solid var(--line); }
  table.t tbody tr:last-child td { border-bottom: 0; }
  table.t tbody td.label { font-weight:700; color: var(--brand); }
  table.t tbody td.num   { font-family: 'Inter', sans-serif; font-weight:600; text-align:left; direction:ltr; }
  table.t tbody td.en    { font-family: 'Inter', sans-serif; direction:ltr; text-align:left; }

  .glossary { display: grid; gap: 0; }
  .gloss-row { padding: 12px 0; border-bottom: 1px solid var(--line); }
  .gloss-row:last-child { border-bottom: 0; }
  .gloss-term { font-family: 'Inter', sans-serif; font-weight: 800; color: var(--brand); font-size: 12pt; }
  .gloss-ar   { color: var(--muted); font-size: 10pt; margin-right: 12px; }
  .gloss-def  { font-size: 10.5pt; color: var(--ink-2); margin-top: 4px; line-height: 1.8; }

  .toc-item { display:flex; gap:14px; padding:10px 0; border-bottom:1px dashed var(--line); }
  .toc-item .n { width:30px; height:30px; background:var(--soft); color:var(--brand); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11pt; flex-shrink:0; }
  .toc-item .t { flex:1; }
  .toc-item .t .ttl { font-size:11.5pt; font-weight:700; color:var(--ink); }
  .toc-item .t .dsc { font-size:9.5pt; color:var(--muted); margin-top:2px; }
  .toc-item .p { font-size:9.5pt; color:var(--brand); font-weight:700; align-self:center; }

  .why {
    margin-top: 18px; padding: 14px 16px;
    background: linear-gradient(135deg, #001f1a, #003932);
    color: #fff; border-radius: 8px; border-right: 4px solid var(--sea-bright);
  }
  .why h5 { font-size:10pt; font-weight:800; color: var(--sea-bright); letter-spacing:0.4px; text-transform:uppercase; margin-bottom:6px; }
  .why p { font-size:10.5pt; color: #fff; opacity:0.92; margin:0; }

  .pf { margin-top:auto; padding-top:14px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:8.5pt; color:var(--muted); }
  .pf .b { color: var(--brand); font-weight:700; }

  em.en-inline { font-family: 'Inter', sans-serif; font-style: normal; font-weight: 700; color: var(--brand); }
</style>
</head>
<body>

<!-- ─── COVER ─── -->
<div class="page cover">
  <div class="cover-body">
    <div>
      <span class="cover-tag">دليل شخصي · غير رسمي</span>
      <h1>كيف يُحسب الـ <em class="en">IPI</em>؟</h1>
      <div class="sub">دليل مكتوب لك أنت — ابدأ من الصفر بدون أي خلفية سابقة. كل المصطلحات بالإنجليزي مع فهرس يشرحها، وكل مثال جاهز للتطبيق في الـ <em class="en">IPI Calculator</em> في البورتل عشان تجرّبه بنفسك وتشوف نفس النتيجة.</div>
    </div>
    <div class="footer-block">
      <div>
        <div class="l">للمستخدم</div>
        <div class="v">محمد العبدالمحسن<br>منسّق <span class="en">PMO</span></div>
      </div>
      <div>
        <div class="l">المرجع</div>
        <div class="v"><span class="en">IPI Personal Explainer</span><br>إصدار 1 · ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</div>
      </div>
    </div>
  </div>
</div>

<!-- ─── TOC ─── -->
<div class="page">
  <div class="ph"><span class="t">الفهرس</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">المحتويات</h2>
  <div class="sec-sub">كل قسم قائم بذاته — ابدأ من أي مكان.</div>
  <div>
    <div class="toc-item"><div class="n">1</div><div class="t"><div class="ttl">فهرس المصطلحات (<span class="en-inline">Glossary</span>)</div><div class="dsc">كل المصطلحات الإنجليزية اللي راح تشوفها مع شرح بسيط</div></div><div class="p">ص.3</div></div>
    <div class="toc-item"><div class="n">2</div><div class="t"><div class="ttl">ما هو الـ <span class="en-inline">IPI</span>؟</div><div class="dsc">الفكرة الأساسية في 30 ثانية</div></div><div class="p">ص.5</div></div>
    <div class="toc-item"><div class="n">3</div><div class="t"><div class="ttl">المكوّنات الثلاثة</div><div class="dsc">SPI + CPI + MCI</div></div><div class="p">ص.6</div></div>
    <div class="toc-item"><div class="n">4</div><div class="t"><div class="ttl">SPI — جدول الإنجاز</div><div class="dsc">مثال جاهز للـ Calculator</div></div><div class="p">ص.7</div></div>
    <div class="toc-item"><div class="n">5</div><div class="t"><div class="ttl">CPI — كفاءة الميزانية</div><div class="dsc">مثال جاهز للـ Calculator</div></div><div class="p">ص.9</div></div>
    <div class="toc-item"><div class="n">6</div><div class="t"><div class="ttl">MCI — التزام التوثيق</div><div class="dsc">مثال جاهز للـ Calculator</div></div><div class="p">ص.10</div></div>
    <div class="toc-item"><div class="n">7</div><div class="t"><div class="ttl">عقوبة الـ Roadmap</div><div class="dsc">مثال جاهز للـ Calculator</div></div><div class="p">ص.11</div></div>
    <div class="toc-item"><div class="n">8</div><div class="t"><div class="ttl">جمع المكوّنات في رقم واحد</div><div class="dsc">الأوزان وإعادة المعايرة</div></div><div class="p">ص.12</div></div>
    <div class="toc-item"><div class="n">9</div><div class="t"><div class="ttl">Snapshot vs Time-Weighted</div><div class="dsc">رقم لحظي مقابل متوسط 90 يوم</div></div><div class="p">ص.13</div></div>
    <div class="toc-item"><div class="n">10</div><div class="t"><div class="ttl">مثال كامل من الـ Calculator</div><div class="dsc">سيناريو واقعي خطوة بخطوة</div></div><div class="p">ص.14</div></div>
    <div class="toc-item"><div class="n">11</div><div class="t"><div class="ttl">قراءة الرقم النهائي</div><div class="dsc">الفئات الأربع وما تعني</div></div><div class="p">ص.15</div></div>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span> · لك فقط</span><span>صفحة 2</span></div>
</div>

<!-- ─── GLOSSARY 1 ─── -->
<div class="page">
  <div class="ph"><span class="t">فهرس المصطلحات</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">١. فهرس المصطلحات</h2>
  <div class="sec-sub">الجزء الأوّل · المصطلحات الأساسية</div>

  <div class="glossary">

    <div class="gloss-row">
      <span class="gloss-term">IPI</span>
      <span class="gloss-ar">Index of Project Implementation — مؤشّر تنفيذ المشروع</span>
      <div class="gloss-def">رقم واحد بين <strong>0 و 115</strong> يلخّص أداء المشروع. أعلى = أفضل. هو الرقم الكبير اللي تشوفه في كل أنحاء البورتل.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">SPI</span>
      <span class="gloss-ar">Schedule Performance Index — مؤشّر أداء الجدول</span>
      <div class="gloss-def">يقيس هل المشروع <strong>متقدّم أو متأخّر</strong> عن الجدول الزمني. أكبر من 1 = متقدّم. أقل من 1 = متأخّر. يأخذ 50% من وزن الـ IPI.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">CPI</span>
      <span class="gloss-ar">Cost Performance Index — مؤشّر أداء التكلفة</span>
      <div class="gloss-def">يقيس هل المشروع <strong>أرخص أو أغلى</strong> من الميزانية. أكبر من 1 = أرخص. أقل من 1 = أغلى. يأخذ 25% من وزن الـ IPI.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">MCI</span>
      <span class="gloss-ar">Artefact Compliance Index — مؤشّر التزام التوثيق</span>
      <div class="gloss-def">يقيس <strong>كم وثيقة من الوثائق المطلوبة معتمدة</strong>. قيمته بين 0 و 1. يأخذ 25% من وزن الـ IPI.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">EV — Earned Value</span>
      <span class="gloss-ar">القيمة المكتسبة (اللي أنجزته فعلاً)</span>
      <div class="gloss-def">يمثّل "كم من الشغل أنجزته" بصيغة <strong>نسبة بين 0 و 1</strong>. لو أنجزت 50% من المشروع → EV = 0.50.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">PV — Planned Value</span>
      <span class="gloss-ar">القيمة المخطّطة (اللي كان المفروض تنجزه)</span>
      <div class="gloss-def">يمثّل "كم كان المفروض تنجز إلى اليوم" بصيغة نسبة بين 0 و 1. يُحسب من <strong>الأيام المنقضية ÷ المدة الكاملة</strong>.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">BCWP — Budgeted Cost of Work Performed</span>
      <span class="gloss-ar">القيمة المالية للشغل المنجز</span>
      <div class="gloss-def">يحسب كم تساوي قيمة الشغل اللي أنجزته بالـ <strong>ريال السعودي</strong>. الصيغة: <em>الميزانية × نسبة الإنجاز</em>. لو ميزانيتك مليون وأنجزت 50% → BCWP = 500,000 ريال.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">AC — Actual Cost</span>
      <span class="gloss-ar">المبلغ المصروف فعلاً</span>
      <div class="gloss-def">المبلغ اللي صرفته فعلاً على المشروع لليوم. يجي من الفواتير الحقيقية.</div>
    </div>

  </div>

  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 3</span></div>
</div>

<!-- ─── GLOSSARY 2 ─── -->
<div class="page">
  <div class="ph"><span class="t">فهرس المصطلحات (تابع)</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">فهرس المصطلحات</h2>
  <div class="sec-sub">الجزء الثاني · مصطلحات التوقيت والتقييم</div>

  <div class="glossary">

    <div class="gloss-row">
      <span class="gloss-term">Snapshot</span>
      <span class="gloss-ar">لقطة لحظية</span>
      <div class="gloss-def">قيمة الـ IPI <strong>في لحظة معيّنة</strong>. كل مرة تضغط "Save Update" تنشئ snapshot جديد. تعتبر "صورة فوتوغرافية" للأداء في تلك اللحظة.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">Time-Weighted IPI</span>
      <span class="gloss-ar">المعدّل المرجّح بالزمن</span>
      <div class="gloss-def">متوسط الـ IPI عبر <strong>آخر 90 يوم</strong>، مرجّح بالمدة اللي بقى فيها كل snapshot. هذا هو الرقم الكبير اللي تشوفه في البورتل — يعكس الأداء التراكمي، مش لحظة واحدة.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">As-of Date</span>
      <span class="gloss-ar">تاريخ "كأنه اليوم"</span>
      <div class="gloss-def">التاريخ اللي يحسب الـ engine الـ IPI كأنه هذا اليوم. عادةً = اليوم الحالي. يستخدم في الـ Calculator للسماح بسيناريوهات افتراضية.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">Roadmap Deadline</span>
      <span class="gloss-ar">الموعد الاستراتيجي</span>
      <div class="gloss-def">الموعد النهائي اللي تحدّده الإدارة للمشروع. إذا تجاوزته، تبدأ <strong>عقوبة 1% يومياً</strong> تنخصم من الـ SPI.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">Cap (1.20)</span>
      <span class="gloss-ar">الحد الأقصى</span>
      <div class="gloss-def">حتى لو أنت متقدّم بـ 5 أضعاف، الـ SPI و CPI يتقصّرون عند <strong>1.20</strong>. هذا الحد يخلّي الـ IPI ما يتجاوز 115.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">Gate</span>
      <span class="gloss-ar">بوّابة المرحلة</span>
      <div class="gloss-def">المشروع يمشي عبر <strong>5 محطّات</strong>: Gate 1 (طلب)، Gate 2 (تأسيس)، Gate 3 (تخطيط)، Gate 4 (تنفيذ)، Gate 5 (إغلاق). كل محطّة تتطلّب وثائق محدّدة.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">Re-normalisation</span>
      <span class="gloss-ar">إعادة المعايرة</span>
      <div class="gloss-def">إذا واحد من المكوّنات (مثلاً CPI) <strong>غير متوفّر</strong>، الـ engine يستبعده ويعيد توزيع الأوزان على المكوّنات الموجودة. يمنع تضخيم الـ IPI بإخفاء بيانات.</div>
    </div>

    <div class="gloss-row">
      <span class="gloss-term">Audit Modal</span>
      <span class="gloss-ar">نافذة التدقيق</span>
      <div class="gloss-def">النافذة اللي تنفتح لما تضغط على رقم الـ IPI في البورتل. تعرض <strong>كل خطوة من الحساب</strong> بالأرقام الفعلية، ويمكن حفظها <span class="en">PDF</span>.</div>
    </div>

  </div>

  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 4</span></div>
</div>

<!-- ─── 2. WHAT IS IPI ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 2</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٢. ما هو الـ <span class="en-inline">IPI</span>؟</h2>
  <div class="sec-sub">الفكرة الأساسية في 30 ثانية</div>

  <p>الـ <em class="en-inline">IPI</em> هو <strong>رقم واحد</strong> بين <strong>0 و 115</strong> يلخّص حالة المشروع كاملاً. أعلى = أفضل.</p>

  <div class="callout green">
    <h5>السؤال الذي يجاوب عليه</h5>
    <p>"هل هذا المشروع يمشي حسب الخطّة؟" — في <strong>الجدول الزمني</strong>، <strong>الميزانية</strong>، و<strong>التوثيق</strong>.</p>
  </div>

  <h3>تشبيه بسيط: دفتر علامات الطالب</h3>
  <p>تخيّل الطالب في ثلاث مواد:</p>
  <ul>
    <li><strong>المادة الأولى — الجدول الزمني:</strong> هل يسلّم واجباته في وقتها؟ ← هذي <em class="en-inline">SPI</em></li>
    <li><strong>المادة الثانية — التكلفة:</strong> هل يصرف وقته بكفاءة؟ ← هذي <em class="en-inline">CPI</em></li>
    <li><strong>المادة الثالثة — التوثيق:</strong> هل يسلّم كل الأوراق المطلوبة؟ ← هذي <em class="en-inline">MCI</em></li>
  </ul>
  <p>الـ <em class="en-inline">IPI</em> هو <strong>المعدّل المرجّح</strong> لهذي الثلاث مواد — الجدول الزمني يأخذ نصف الدرجة (لأنه الأهم في تري)، والاثنين الآخرين كل واحد ربع.</p>

  <h3>ليش رقم واحد؟</h3>
  <p>لما عندك <strong>40 مشروع</strong>، ما تقدر تقرأ تفاصيل كل واحد. الرقم الواحد يخلّيك تنظر للمحفظة كلها في ثوانٍ وتعرف:</p>
  <ul>
    <li>أيش يحتاج تدخّل عاجل؟ (أقل من 70)</li>
    <li>أيش يحتاج مراقبة؟ (90 إلى 99)</li>
    <li>أيش يمشي تمام؟ (100 وفوق)</li>
  </ul>

  <h3>المقياس 0–115 (ليش مش 0–100؟)</h3>
  <p>المشروع اللي يخلّص <strong>قبل وقته وتحت ميزانيته</strong> يستحق أكثر من 100. الـ <em class="en-inline">IPI</em> يكافئ التميّز حتى الـ <strong>115</strong>، لكن ما يتجاوزه (لأن أرقام خارقة فوق هذا غالباً تعني خطّة غير واقعية، مش أداء حقيقي).</p>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>الـ IPI هو اللغة المشتركة بين الـ PMO والإدارة. لما تقول "مشروع X عنده IPI = 75"، الكل يفهم فوراً: هذا في خطر. لا حاجة لتفسير.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 5</span></div>
</div>

<!-- ─── 3. THREE COMPONENTS ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 3</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٣. المكوّنات الثلاثة</h2>
  <div class="sec-sub">SPI + CPI + MCI · كل واحد يقيس شي مختلف</div>

  <p>الـ <em class="en-inline">IPI</em> ما يطلع من فراغ — هو <strong>مزيج</strong> من ثلاث قياسات منفصلة، كل واحد يجاوب على سؤال محدّد:</p>

  <table class="t">
    <thead>
      <tr><th>الرمز</th><th>الاسم الكامل</th><th>السؤال</th><th>الوزن</th></tr>
    </thead>
    <tbody>
      <tr>
        <td class="label en"><strong>SPI</strong></td>
        <td class="en">Schedule Performance Index</td>
        <td>هل تمشي حسب الجدول؟</td>
        <td class="num">50%</td>
      </tr>
      <tr>
        <td class="label en"><strong>CPI</strong></td>
        <td class="en">Cost Performance Index</td>
        <td>هل تصرف بكفاءة؟</td>
        <td class="num">25%</td>
      </tr>
      <tr>
        <td class="label en"><strong>MCI</strong></td>
        <td class="en">Artefact Compliance Index</td>
        <td>هل وثائقك معتمدة؟</td>
        <td class="num">25%</td>
      </tr>
    </tbody>
  </table>

  <h3>ليش هذي الأوزان؟</h3>
  <p>في تري، الجدول الزمني (<em class="en-inline">SPI</em>) أهم لأن التأخّر يضر التزامات تنظيمية وتجارية مباشرةً. التكلفة والوثائق مهمّتان لكن أقل تأثيراً على الالتزامات الخارجية. لهذا:</p>

  <div class="math">
    <span class="row">IPI = (SPI × 0.50) + (CPI × 0.25) + (MCI × 0.25)</span>
    <span class="row"><span class="lbl">ثم نضرب الناتج في 100 للحصول على الرقم النهائي</span></span>
  </div>

  <div class="callout amber">
    <h5>قرار سياسة محلّي</h5>
    <p>هذي الأوزان مش معيار صناعي عالمي — هي اختيار من <em class="en-inline">CFO</em> تري ورئيس الـ <em class="en-inline">PMO</em>. لو نقلت البورتل لمؤسّسة أخرى، لازم يقرّروا أوزانهم.</p>
  </div>

  <h3>المدى الممكن لكل مكوّن</h3>
  <ul>
    <li><em class="en-inline">SPI</em>: بين 0 و 1.20 (مقصور عند 1.20)</li>
    <li><em class="en-inline">CPI</em>: بين 0 و 1.20 (مقصور عند 1.20)</li>
    <li><em class="en-inline">MCI</em>: بين 0 و 1.00 (لا يتجاوز 100% توثيق)</li>
  </ul>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>لو شفت <em class="en-inline">IPI</em> = 85، الرقم لوحده ما يكفي. التفصيل (<em class="en-inline">SPI</em>/<em class="en-inline">CPI</em>/<em class="en-inline">MCI</em>) يقول لك "المشكلة في الجدول الزمني" أو "في الميزانية". الـ <em class="en-inline">Audit Modal</em> يعرضهم كلهم.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 6</span></div>
</div>

<!-- ─── 4. SPI ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 4</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٤. <span class="en-inline">SPI</span> — جدول الإنجاز</h2>
  <div class="sec-sub">Schedule Performance Index · أهم مكوّن، 50% من الـ IPI</div>

  <h3>الفكرة في سطر</h3>
  <div class="callout green">
    <p style="font-size:13pt"><strong><em class="en-inline">SPI</em> = اللي أنجزته فعلاً (<em class="en-inline">EV</em>) ÷ اللي كان المفروض تنجزه (<em class="en-inline">PV</em>)</strong></p>
  </div>

  <h3>كيف نحسب <em class="en-inline">EV</em> و <em class="en-inline">PV</em>؟</h3>
  <ul>
    <li><strong><em class="en-inline">EV</em>:</strong> نسبة الإنجاز الفعلية ÷ 100 (مثال: 60% → 0.60)</li>
    <li><strong><em class="en-inline">PV</em>:</strong> الأيام المنقضية ÷ المدّة الكاملة (افتراض خطّي)</li>
  </ul>

  <h3>مثال جاهز للـ <em class="en-inline">IPI Calculator</em></h3>
  <p>افتح <strong>Sidebar → IPI Calculator</strong> في البورتل، ادخل القيم التالية، واضغط <strong>Calculate IPI</strong>:</p>

  <div class="calc">
    <div class="calc-h"><span>المثال 1 — مشروع متقدّم على الخطة</span><span>IPI Calculator</span></div>
    <table>
      <tr><td>Start Date</td><td>2026-01-01</td></tr>
      <tr><td>Planned End</td><td>2026-12-31</td></tr>
      <tr><td>Roadmap Deadline</td><td>(اتركه فاضي)</td></tr>
      <tr><td>As-of Date</td><td>2026-07-01</td></tr>
      <tr><td>Actual Progress %</td><td>60</td></tr>
      <tr><td>Planned Progress %</td><td>(اتركه فاضي)</td></tr>
      <tr><td>Budget (SAR)</td><td>(اتركه فاضي)</td></tr>
      <tr><td>Actual Cost (SAR)</td><td>(اتركه فاضي)</td></tr>
      <tr><td>Current Gate</td><td>Gate 4</td></tr>
      <tr><td>Required Docs · Approved</td><td>(اتركهم فاضيين)</td></tr>
    </table>
  </div>

  <h3>الحساب اليدوي خطوة بخطوة</h3>
  <div class="math">
    <span class="row"><span class="lbl">المدّة الكاملة:</span> من 2026-01-01 إلى 2026-12-31 = <strong>365 يوم</strong></span>
    <span class="row"><span class="lbl">الأيام المنقضية:</span> من 2026-01-01 إلى 2026-07-01 = <strong>181 يوم</strong></span>
    <span class="row"><span class="lbl">PV:</span> 181 ÷ 365 = <strong>0.496</strong> (المفروض تكون أنجزت 49.6%)</span>
    <span class="row"><span class="lbl">EV:</span> 60 ÷ 100 = <strong>0.600</strong> (أنجزت 60% فعلاً)</span>
    <span class="row res">SPI = 0.600 ÷ 0.496 = <strong>1.210</strong> → مقصور عند 1.20</span>
  </div>

  <div class="expect">
    <span class="l">النتيجة المتوقّعة من الـ Calculator</span>
    <span class="v">IPI = 110</span>
  </div>

  <p>الرقم 110 يطلع لأن الـ <em class="en-inline">SPI</em> فقط هو المتوفّر (1.20)، والمكوّنات الأخرى <strong>غير موجودة فتُستبعد</strong>، وبعدها الـ <em class="en-inline">SPI</em> يتحوّل لـ 110 (1.10 × 100 — بسبب re-normalisation).</p>

  <div class="callout blue">
    <h5>جرّبها بنفسك</h5>
    <p>ادخل القيم بالضبط زي ما هي، اضغط Calculate، وأكّد إن الرقم يطلع <strong>110</strong>. لو طلع رقم آخر، احتمال غلطت في تاريخ — راجع الـ Start Date و Planned End.</p>
  </div>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>الـ <em class="en-inline">SPI</em> أهم مكوّن (50%). لو IPI مشروعك ضعيف، 9 من 10 المشكلة في الجدول الزمني. ركّز هنا أوّلاً.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 7</span></div>
</div>

<!-- ─── 4b. SPI continued ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 4 (تابع)</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec"><span class="en-inline">SPI</span> — تفاصيل دقيقة</h2>

  <h3>الحد الأقصى عند 1.20</h3>
  <p>حتى لو الـ <em class="en-inline">EV/PV</em> طلع 3.5 (متقدّم بـ 250%)، الـ <em class="en-inline">SPI</em> يتقصّر عند <strong>1.20</strong>. ليش؟</p>
  <ul>
    <li>منع مشروع واحد "مخطّط بمبالغة" من رفع متوسط المحفظة كلها بشكل وهمي</li>
    <li>أرقام خارقة (مثل 3.0) غالباً تعني خطّة تفاؤلية، مش أداء فعلي مذهل</li>
  </ul>

  <div class="callout amber">
    <h5>غير قياسي عالمياً</h5>
    <p>المعايير العالمية (<em class="en-inline">PMBOK</em> / <em class="en-inline">EVM</em>) <strong>لا تقصّر</strong> الـ <em class="en-inline">SPI</em>. هذا قرار مخصّص لـ تري وموثّق صراحةً في الكود.</p>
  </div>

  <h3>افتراض خطّي (<span class="en-inline">Linear</span>) للـ <em class="en-inline">PV</em></h3>
  <p>الواقع: المشاريع تنجز بـ <strong>منحنى S</strong> (بطيء أوّل، سريع وسط، بطيء آخر). لكن البورتل يفترض إنجاز <strong>متساوي كل يوم</strong> للتبسيط.</p>
  <p>أثر هذا التبسيط: المشاريع تظهر <strong>أسرع من الواقع في منتصف المدّة</strong>، و <strong>أبطأ في نهايتها</strong>. موثّق صراحةً.</p>

  <h3>مثال ثاني: مشروع متأخّر</h3>

  <div class="calc">
    <div class="calc-h"><span>المثال 2 — مشروع متأخّر عن الخطة</span><span>IPI Calculator</span></div>
    <table>
      <tr><td>Start Date</td><td>2026-01-01</td></tr>
      <tr><td>Planned End</td><td>2026-12-31</td></tr>
      <tr><td>As-of Date</td><td>2026-10-01</td></tr>
      <tr><td>Actual Progress %</td><td>50</td></tr>
      <tr><td>Current Gate</td><td>Gate 4</td></tr>
    </table>
  </div>

  <div class="math">
    <span class="row"><span class="lbl">المدّة الكاملة:</span> 365 يوم</span>
    <span class="row"><span class="lbl">الأيام المنقضية:</span> من يناير إلى أكتوبر = <strong>273 يوم</strong></span>
    <span class="row"><span class="lbl">PV:</span> 273 ÷ 365 = <strong>0.748</strong> (مفروض تكون 75% منجز)</span>
    <span class="row"><span class="lbl">EV:</span> <strong>0.500</strong> (أنجزت 50% فقط)</span>
    <span class="row res">SPI = 0.500 ÷ 0.748 = <strong>0.668</strong></span>
  </div>

  <div class="expect">
    <span class="l">النتيجة المتوقّعة من الـ Calculator</span>
    <span class="v">IPI = 67</span>
  </div>

  <p>الـ <em class="en-inline">SPI</em> = 0.668 ضعيف جداً — يعني المشروع في خطر. لو ضربناه في 100 يطلع 67 (وراح يظهر بـ <strong>اللون الأحمر</strong> = Critical).</p>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>إذا في الـ Calculator <em class="en-inline">SPI</em> طلع أقل من 0.9، اعتبره مؤشّر إنذار. راجع تواريخ المشروع — يا إما الخطّة كانت متفائلة، يا إما فيه عقبات حقيقية تستحقّ التصعيد.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 8</span></div>
</div>

<!-- ─── 5. CPI ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 5</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٥. <span class="en-inline">CPI</span> — كفاءة الميزانية</h2>
  <div class="sec-sub">Cost Performance Index · 25% من الـ IPI</div>

  <h3>الفكرة في سطر</h3>
  <div class="callout green">
    <p style="font-size:13pt"><strong><em class="en-inline">CPI</em> = قيمة الشغل المنجز (<em class="en-inline">BCWP</em>) ÷ المبلغ المصروف فعلاً (<em class="en-inline">AC</em>)</strong></p>
  </div>

  <h3>تشبيه: مقاول بناء</h3>
  <p>مقاول وعد يبني البيت بـ <strong>1,000,000 ريال</strong>. أنجز <strong>50%</strong> من البيت. كم المفروض يكون صرف؟</p>
  <ul>
    <li><strong><em class="en-inline">BCWP</em>:</strong> 1,000,000 × 50% = <strong>500,000 ريال</strong> (قيمة الشغل اللي أنجزه)</li>
    <li>إذا صرف <strong>400,000</strong> فقط: <em class="en-inline">CPI</em> = 500,000 ÷ 400,000 = <strong>1.25</strong> → كفء</li>
    <li>إذا صرف <strong>600,000</strong>: <em class="en-inline">CPI</em> = 500,000 ÷ 600,000 = <strong>0.83</strong> → يصرف زيادة</li>
  </ul>

  <h3>مثال جاهز للـ <em class="en-inline">IPI Calculator</em></h3>

  <div class="calc">
    <div class="calc-h"><span>المثال 3 — مشروع تحت الميزانية</span><span>IPI Calculator</span></div>
    <table>
      <tr><td>Start Date</td><td>2026-01-01</td></tr>
      <tr><td>Planned End</td><td>2026-12-31</td></tr>
      <tr><td>As-of Date</td><td>2026-07-01</td></tr>
      <tr><td>Actual Progress %</td><td>50</td></tr>
      <tr><td>Budget (SAR)</td><td>1,000,000</td></tr>
      <tr><td>Actual Cost (SAR)</td><td>400,000</td></tr>
      <tr><td>Current Gate</td><td>Gate 4</td></tr>
    </table>
  </div>

  <h3>الحساب اليدوي</h3>
  <div class="math">
    <span class="row"><span class="lbl">PV:</span> 181 ÷ 365 = <strong>0.496</strong></span>
    <span class="row"><span class="lbl">EV:</span> <strong>0.500</strong></span>
    <span class="row"><span class="lbl">SPI:</span> 0.500 ÷ 0.496 = <strong>1.008</strong></span>
    <span class="row"><span class="lbl">BCWP:</span> 1,000,000 × 0.50 = <strong>500,000 SAR</strong></span>
    <span class="row"><span class="lbl">CPI:</span> 500,000 ÷ 400,000 = <strong>1.250</strong> → مقصور عند 1.20</span>
    <span class="row res">IPI = (1.008 × 0.667) + (1.20 × 0.333) = 0.672 + 0.400 = 1.072 × 100 = <strong>107</strong></span>
  </div>

  <div class="expect">
    <span class="l">النتيجة المتوقّعة</span>
    <span class="v">IPI = 107</span>
  </div>

  <p>تنبيه: الأوزان هنا <strong>0.667 و 0.333</strong> (مش 0.50 و 0.25) لأن الـ <em class="en-inline">MCI</em> غير متوفّر، فأعيدت معايرة الأوزان.</p>

  <h3>حماية من الأرقام السالبة</h3>
  <p>لو <em class="en-inline">Actual Cost</em> كان <strong>صفر أو سالب</strong> (مثلاً <em class="en-inline">refund</em>)، الـ <em class="en-inline">CPI</em> ما يحسب — يُستبعد. سابقاً كان يطلع رقم سالب يفسد الـ <em class="en-inline">IPI</em>.</p>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>الـ <em class="en-inline">CPI</em> يكشف مشاريع تستنزف الميزانية بدون نتيجة. لو CPI = 0.5، كل ريال تصرفه يولّد نصف ريال قيمة فقط — مشكلة جدّية حتى لو الجدول الزمني تمام.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 9</span></div>
</div>

<!-- ─── 6. MCI ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 6</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٦. <span class="en-inline">MCI</span> — التزام التوثيق</h2>
  <div class="sec-sub">Artefact Compliance Index · 25% من الـ IPI</div>

  <h3>الفكرة في سطر</h3>
  <div class="callout green">
    <p style="font-size:13pt"><strong><em class="en-inline">MCI</em> = (وثائق معتمدة + نص وثائق قيد المراجعة) ÷ وثائق مطلوبة في الـ <em class="en-inline">Gate</em> الحالي</strong></p>
  </div>

  <h3>منطق الـ <em class="en-inline">Gate-aware</em></h3>
  <p>المشروع في <em class="en-inline">Gate 2</em> ما يلام على غياب وثائق <em class="en-inline">Gate 4</em>. كل وثيقة لها "<em class="en-inline">requiredAtGate</em>"، والـ <em class="en-inline">MCI</em> يعدّ فقط الوثائق المستحقّة <strong>الآن أو قبل</strong>.</p>

  <h3>سلّم النقاط</h3>
  <table class="t">
    <thead><tr><th>حالة الوثيقة</th><th>النقاط</th><th>التعليق</th></tr></thead>
    <tbody>
      <tr><td class="en"><strong>Approved</strong> / Final / Received / Current</td><td class="num">1.0</td><td>اعتماد كامل</td></tr>
      <tr><td class="en"><strong>Submitted</strong> / Under Review</td><td class="num">0.5</td><td>قيد المراجعة — نص نقطة</td></tr>
      <tr><td class="en"><strong>Draft</strong> / Pending / Missing</td><td class="num">0.0</td><td>صفر</td></tr>
    </tbody>
  </table>

  <h3>مثال جاهز للـ <em class="en-inline">IPI Calculator</em></h3>

  <div class="calc">
    <div class="calc-h"><span>المثال 4 — توثيق ممتاز</span><span>IPI Calculator</span></div>
    <table>
      <tr><td>Start Date</td><td>2026-01-01</td></tr>
      <tr><td>Planned End</td><td>2026-12-31</td></tr>
      <tr><td>As-of Date</td><td>2026-07-01</td></tr>
      <tr><td>Actual Progress %</td><td>50</td></tr>
      <tr><td>Current Gate</td><td>Gate 4</td></tr>
      <tr><td>Required Docs</td><td>4</td></tr>
      <tr><td>Approved Docs</td><td>4</td></tr>
    </table>
  </div>

  <div class="math">
    <span class="row"><span class="lbl">MCI:</span> 4 ÷ 4 = <strong>1.000</strong> (100% توثيق)</span>
    <span class="row"><span class="lbl">SPI:</span> 1.008 (من الحساب السابق)</span>
    <span class="row res">IPI = (1.008 × 0.667) + (1.00 × 0.333) = 0.672 + 0.333 = 1.005 × 100 = <strong>101</strong></span>
  </div>

  <div class="expect">
    <span class="l">النتيجة المتوقّعة</span>
    <span class="v">IPI = 101</span>
  </div>

  <h3>مثال ثاني: توثيق ناقص</h3>

  <div class="calc">
    <div class="calc-h"><span>المثال 5 — نص الوثائق فقط معتمدة</span><span>IPI Calculator</span></div>
    <table>
      <tr><td>(نفس الحقول السابقة)</td><td>—</td></tr>
      <tr><td>Required Docs</td><td>4</td></tr>
      <tr><td>Approved Docs</td><td>2</td></tr>
    </table>
  </div>

  <div class="math">
    <span class="row"><span class="lbl">MCI:</span> 2 ÷ 4 = <strong>0.500</strong> (50% توثيق فقط)</span>
    <span class="row res">IPI = (1.008 × 0.667) + (0.500 × 0.333) = 0.672 + 0.166 = 0.838 × 100 = <strong>84</strong></span>
  </div>

  <div class="expect">
    <span class="l">النتيجة المتوقّعة</span>
    <span class="v">IPI = 84 (At Risk)</span>
  </div>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>الـ <em class="en-inline">MCI</em> الوحيد اللي تقدر ترفعه <strong>بضغطة زر</strong> — اعتماد الوثائق المعلّقة. لو <em class="en-inline">IPI</em> ضعيف بسبب <em class="en-inline">MCI</em>، الحل في ساعات، مش أسابيع.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 10</span></div>
</div>

<!-- ─── 7. PENALTY ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 7</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٧. عقوبة الـ <span class="en-inline">Roadmap</span></h2>
  <div class="sec-sub">Penalty for missing the strategic deadline</div>

  <h3>الفكرة</h3>
  <p>كل مشروع له <em class="en-inline">Roadmap Deadline</em> — الموعد الاستراتيجي اللي تحدّده الإدارة. إذا المشروع <strong>تجاوزه</strong>، تنخصم 1% من الـ <em class="en-inline">SPI</em> كل يوم.</p>

  <table class="t">
    <thead><tr><th>أيام بعد الموعد</th><th>قيمة الـ Penalty</th><th>الأثر</th></tr></thead>
    <tbody>
      <tr><td>0 يوم</td><td class="num">1.000</td><td>لا عقوبة</td></tr>
      <tr><td>10 أيام</td><td class="num">0.900</td><td>خصم 10% من SPI</td></tr>
      <tr><td>50 يوم</td><td class="num">0.500</td><td>خصم 50%</td></tr>
      <tr><td>100 يوم</td><td class="num">0.000</td><td>الـ SPI صفر تماماً</td></tr>
    </tbody>
  </table>

  <h3>مثال جاهز للـ <em class="en-inline">IPI Calculator</em></h3>

  <div class="calc">
    <div class="calc-h"><span>المثال 6 — مشروع تجاوز الـ Roadmap بـ 30 يوم</span><span>IPI Calculator</span></div>
    <table>
      <tr><td>Start Date</td><td>2026-01-01</td></tr>
      <tr><td>Planned End</td><td>2026-08-31</td></tr>
      <tr><td>Roadmap Deadline</td><td>2026-06-01</td></tr>
      <tr><td>As-of Date</td><td>2026-07-01</td></tr>
      <tr><td>Actual Progress %</td><td>80</td></tr>
      <tr><td>Current Gate</td><td>Gate 4</td></tr>
    </table>
  </div>

  <div class="math">
    <span class="row"><span class="lbl">Days past Roadmap:</span> من 2026-06-01 إلى 2026-07-01 = <strong>30 يوم</strong></span>
    <span class="row"><span class="lbl">Penalty:</span> 1 − (30 ÷ 100) = <strong>0.70</strong></span>
    <span class="row"><span class="lbl">المدّة الكاملة:</span> من 2026-01-01 إلى 2026-08-31 = <strong>243 يوم</strong></span>
    <span class="row"><span class="lbl">الأيام المنقضية:</span> 181 يوم</span>
    <span class="row"><span class="lbl">PV:</span> 181 ÷ 243 = <strong>0.745</strong></span>
    <span class="row"><span class="lbl">EV:</span> <strong>0.800</strong></span>
    <span class="row"><span class="lbl">SPI خام:</span> 0.800 ÷ 0.745 = <strong>1.074</strong></span>
    <span class="row"><span class="lbl">SPI × Penalty:</span> 1.074 × 0.70 = <strong>0.752</strong></span>
    <span class="row res">IPI = 0.752 × 100 = <strong>75</strong></span>
  </div>

  <div class="expect">
    <span class="l">النتيجة المتوقّعة</span>
    <span class="v">IPI = 75 (At Risk)</span>
  </div>

  <h3>ترتيب الحساب مهم</h3>
  <p>الـ <em class="en-inline">engine</em> يحسب بالترتيب:</p>
  <ol style="padding-right:24px; font-size:11pt; line-height:2;">
    <li>احسب <em class="en-inline">SPI</em> الخام (بدون <em class="en-inline">cap</em>)</li>
    <li>اضرب في الـ <em class="en-inline">Penalty</em></li>
    <li>قصّر الناتج عند 1.20</li>
  </ol>
  <p>سابقاً كان الـ <em class="en-inline">cap</em> يطبّق قبل الـ <em class="en-inline">Penalty</em> — وذلك كان bug رياضي يظلم المشاريع المتقدّمة اللي تتأخّر قليلاً. أُصلح.</p>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>إذا مشروعك قارب الـ <em class="en-inline">Roadmap Deadline</em>، فاحسب كل يوم. بعد 100 يوم بدون تعديل خطّة → <em class="en-inline">SPI</em> = 0 → الـ <em class="en-inline">IPI</em> ينخفض بقسوة وما يتعافى بسهولة.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 11</span></div>
</div>

<!-- ─── 8. COMBINING ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 8</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٨. جمع المكوّنات في رقم واحد</h2>
  <div class="sec-sub">الأوزان وإعادة المعايرة</div>

  <h3>الحالة الطبيعية (كل البيانات متوفّرة)</h3>
  <div class="math">
    <span class="row">IPI = (SPI × 0.50) + (CPI × 0.25) + (MCI × 0.25)</span>
  </div>

  <p>مثال: SPI = 1.10، CPI = 0.95، MCI = 0.80:</p>
  <div class="math">
    <span class="row">IPI = (1.10 × 0.50) + (0.95 × 0.25) + (0.80 × 0.25)</span>
    <span class="row">    = 0.550 + 0.238 + 0.200</span>
    <span class="row res">    = 0.988 × 100 = <strong>99 (Watch)</strong></span>
  </div>

  <h3>مشكلة قديمة: <em class="en-inline">null</em> = 1.0 (محايد)</h3>
  <p>قبل الإصلاح، لو المشروع ما عنده ميزانية مدخلة (<em class="en-inline">CPI = null</em>)، الـ engine كان يعامله كـ 1.0 (محايد) — يعني يكافئ غياب البيانات!</p>

  <div class="callout red">
    <h5>حافز فاسد</h5>
    <p>الـ <em class="en-inline">PM</em> يقدر يخفي بيانات لتضخيم <em class="en-inline">IPI</em>! ما يدخل <em class="en-inline">Actual Cost</em> = <em class="en-inline">CPI</em> = 1.0 محايد = <em class="en-inline">IPI</em> أعلى من الواقع.</p>
  </div>

  <h3>الحل: <em class="en-inline">Re-normalisation</em> (إعادة المعايرة)</h3>
  <p>المكوّنات الناقصة <strong>تُستبعد</strong>، والأوزان تُعاد معايرتها لتجمع 1.0.</p>

  <h4>مثال: مشروع بدون <em class="en-inline">CPI</em></h4>
  <div class="math">
    <span class="row"><span class="lbl">المكوّنات المتوفّرة:</span> SPI + MCI</span>
    <span class="row"><span class="lbl">الأوزان الأصلية:</span> 0.50 + 0.25 = 0.75</span>
    <span class="row"><span class="lbl">الأوزان بعد المعايرة:</span></span>
    <span class="row">     SPI = 0.50 ÷ 0.75 = <strong>0.667</strong> (يصير الثلثين)</span>
    <span class="row">     MCI = 0.25 ÷ 0.75 = <strong>0.333</strong> (يصير الثلث)</span>
    <span class="row res">IPI = (SPI × 0.667) + (MCI × 0.333)</span>
  </div>

  <h4>حالة قصوى: <em class="en-inline">SPI</em> فقط</h4>
  <div class="math">
    <span class="row">SPI = 0.90، CPI = null، MCI = null</span>
    <span class="row res">IPI = SPI × 1.0 = 0.90 × 100 = <strong>90</strong></span>
    <span class="row><span class="lbl">(SPI يأخذ الوزن الكامل لأنه الوحيد المتوفّر)</span></span>
  </div>

  <h3>الحالة الفارغة تماماً</h3>
  <p>لو كل المكوّنات <em class="en-inline">null</em> (مشروع جديد بدون بيانات)، الـ <em class="en-inline">IPI</em> يطلع <em class="en-inline">null</em> ويظهر "<em class="en-inline">Pending Plan</em>" في البورتل.</p>

  <div class="callout green">
    <h5>عدالة الإصلاح</h5>
    <p>الآن: <em class="en-inline">PM</em> يدخل بيانات <em class="en-inline">CPI</em> ضعيفة (مثلاً 0.5) يطلع <em class="en-inline">IPI</em> أقل من <em class="en-inline">PM</em> ما يدخل شي. هذا الصحيح — الإخفاء ما يكافأ.</p>
  </div>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>إذا شفت <em class="en-inline">IPI</em> مشروع غير متوقّع عالي، افتح الـ <em class="en-inline">Audit Modal</em> واشيك على المكوّنات. لو فيه <em class="en-inline">null</em> كثير، الرقم يعتمد على بيانات ناقصة — قل لـ PM يدخل الكل.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 12</span></div>
</div>

<!-- ─── 9. SNAPSHOT VS TIME-WEIGHTED ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 9</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">٩. <span class="en-inline">Snapshot</span> vs <span class="en-inline">Time-Weighted</span></h2>
  <div class="sec-sub">رقم لحظي مقابل متوسط 90 يوم</div>

  <h3>المفهوم الأساسي</h3>
  <p>كل ضغطة "<em class="en-inline">Save Update</em>" تنشئ <em class="en-inline">snapshot</em> — صورة لحظية للـ <em class="en-inline">IPI</em>. هذي اللقطات تتراكم في تاريخ المشروع.</p>

  <table class="t">
    <thead><tr><th>المفهوم</th><th>التعريف</th><th>أين يظهر</th></tr></thead>
    <tbody>
      <tr>
        <td class="label en">Snapshot</td>
        <td>الرقم اللحظي — احسب من بيانات المشروع الحالية</td>
        <td class="en">IPI Calculator · Latest tag</td>
      </tr>
      <tr>
        <td class="label en">Time-Weighted</td>
        <td>متوسط مرجّح بالزمن لآخر 90 يوم من الـ snapshots</td>
        <td>كل الـ KPIs · Dept · Portfolio · Project Hero</td>
      </tr>
    </tbody>
  </table>

  <h3>مثال يوضّح الفرق</h3>
  <p>مشروع له 4 <em class="en-inline">snapshots</em> عبر 4 شهور:</p>

  <table class="t">
    <thead><tr><th>التاريخ</th><th>IPI</th><th>مدّة بقاء</th></tr></thead>
    <tbody>
      <tr><td class="en">2026-05-01</td><td class="num">80</td><td>31 يوم</td></tr>
      <tr><td class="en">2026-06-01</td><td class="num">80</td><td>30 يوم</td></tr>
      <tr><td class="en">2026-07-01</td><td class="num">60</td><td>31 يوم</td></tr>
      <tr><td class="en">2026-08-01</td><td class="num">115</td><td>30 يوم (الأحدث)</td></tr>
    </tbody>
  </table>

  <h4>Snapshot (الرقم اللحظي):</h4>
  <p>= القيمة الأخيرة فقط = <strong>115</strong></p>

  <h4>Time-Weighted (متوسط مرجّح):</h4>
  <div class="math">
    <span class="row">(80×31) + (80×30) + (60×31) + (115×30)</span>
    <span class="row">─────────────────────────────────────</span>
    <span class="row">    31 + 30 + 31 + 30 = 122 يوم</span>
    <span class="row">= 2480 + 2400 + 1860 + 3450 = <strong>10,190</strong></span>
    <span class="row res">10,190 ÷ 122 = <strong>84</strong></span>
  </div>

  <h3>ليش الفرق؟</h3>
  <p>الـ <em class="en-inline">Snapshot</em> يخدع — مشروع متعثّر 3 شهور ثم انفجر في الأسبوع الأخير يطلع 115. الـ <em class="en-inline">Time-Weighted</em> يكشف الواقع: 84.</p>

  <h3>النافذة المتحرّكة 90 يوم</h3>
  <p>أي <em class="en-inline">snapshot</em> أقدم من 90 يوم يُستبعد تماماً. ما نخلّي قراءة قديمة من سنة كاملة تجرّ المتوسط.</p>

  <div class="callout blue">
    <h5>متى يتطابقان؟</h5>
    <p>لو المشروع جديد وما عنده تاريخ بعد، الـ <em class="en-inline">Time-Weighted</em> يطابق الـ <em class="en-inline">Snapshot</em> (لا يوجد ما يعدّل).</p>
  </div>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>الـ <em class="en-inline">Snapshot</em> يقول "وين أنت الآن"، الـ <em class="en-inline">Time-Weighted</em> يقول "كيف كان أداؤك عبر الوقت". الرقم الكبير في البورتل = <em class="en-inline">Time-Weighted</em> (الواقع التراكمي). تشوف الـ <em class="en-inline">Snapshot</em> كمعلومة ثانوية بجنبه.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 13</span></div>
</div>

<!-- ─── 10. COMPREHENSIVE EXAMPLE ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 10</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">١٠. مثال كامل — مشروع واقعي</h2>
  <div class="sec-sub">سيناريو من البداية للنهاية</div>

  <h3>السيناريو: تطبيق العملاء المتنقّل</h3>

  <div class="calc">
    <div class="calc-h"><span>المثال 7 — مشروع متوسّط الأداء</span><span>IPI Calculator</span></div>
    <table>
      <tr><td>Start Date</td><td>2026-01-01</td></tr>
      <tr><td>Planned End</td><td>2026-12-31</td></tr>
      <tr><td>Roadmap Deadline</td><td>2026-10-31</td></tr>
      <tr><td>As-of Date</td><td>2026-07-01</td></tr>
      <tr><td>Actual Progress %</td><td>55</td></tr>
      <tr><td>Budget (SAR)</td><td>3,000,000</td></tr>
      <tr><td>Actual Cost (SAR)</td><td>1,500,000</td></tr>
      <tr><td>Current Gate</td><td>Gate 3</td></tr>
      <tr><td>Required Docs</td><td>4</td></tr>
      <tr><td>Approved Docs</td><td>3</td></tr>
    </table>
  </div>

  <h3>الحساب خطوة بخطوة</h3>

  <h4>الخطوة 1 — SPI</h4>
  <div class="math">
    <span class="row"><span class="lbl">المدّة الكاملة:</span> 365 يوم</span>
    <span class="row"><span class="lbl">الأيام المنقضية:</span> 181 يوم</span>
    <span class="row"><span class="lbl">PV:</span> 181 ÷ 365 = 0.496</span>
    <span class="row"><span class="lbl">EV:</span> 0.55</span>
    <span class="row res">SPI خام = 0.55 ÷ 0.496 = <strong>1.109</strong></span>
  </div>

  <h4>الخطوة 2 — Penalty</h4>
  <div class="math">
    <span class="row"><span class="lbl">Roadmap = 2026-10-31، اليوم = 2026-07-01</span></span>
    <span class="row res">As-of قبل Roadmap بـ 122 يوم → Penalty = <strong>1.000</strong></span>
  </div>

  <h4>الخطوة 3 — SPI Final</h4>
  <div class="math">
    <span class="row res">spiFinal = min(1.20, 1.109 × 1.000) = <strong>1.109</strong></span>
  </div>

  <h4>الخطوة 4 — CPI</h4>
  <div class="math">
    <span class="row"><span class="lbl">BCWP:</span> 3,000,000 × 0.55 = <strong>1,650,000 SAR</strong></span>
    <span class="row res">CPI = 1,650,000 ÷ 1,500,000 = <strong>1.100</strong></span>
  </div>

  <h4>الخطوة 5 — MCI</h4>
  <div class="math">
    <span class="row res">MCI = 3 ÷ 4 = <strong>0.750</strong></span>
  </div>

  <h4>الخطوة 6 — IPI النهائي</h4>
  <div class="math">
    <span class="row">IPI = (1.109 × 0.50) + (1.100 × 0.25) + (0.750 × 0.25)</span>
    <span class="row">    = 0.555 + 0.275 + 0.188</span>
    <span class="row res">    = 1.018 × 100 = <strong>102</strong></span>
  </div>

  <div class="expect">
    <span class="l">النتيجة المتوقّعة من الـ Calculator</span>
    <span class="v">IPI = 102 (Over Achieved)</span>
  </div>

  <p>المشروع متقدّم على الخطّة بقليل (SPI 1.11)، تحت الميزانية (CPI 1.10)، لكن التوثيق ناقص (MCI 0.75). لو اعتمدت الوثيقة الرابعة، الـ IPI يصير 105.</p>

  <div class="why">
    <h5>التحقّق</h5>
    <p>افتح الـ <em class="en-inline">IPI Calculator</em> في البورتل، ادخل القيم بالحرف، اضغط <em class="en-inline">Calculate</em>. لازم يطلع 102. الـ <em class="en-inline">Audit Modal</em> اللي يفتح بضغطة على الرقم يعرض كل هذي الخطوات.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 14</span></div>
</div>

<!-- ─── 11. READING THE NUMBER ─── -->
<div class="page">
  <div class="ph"><span class="t">القسم 11</span><span class="n en">IPI-EXPLAINER / 2026</span></div>
  <h2 class="sec">١١. قراءة الرقم النهائي</h2>
  <div class="sec-sub">الفئات وما تعني كل واحدة</div>

  <h3>السلّم الكامل</h3>
  <table class="t">
    <thead><tr><th>المدى</th><th>الفئة</th><th>اللون</th><th>المعنى</th></tr></thead>
    <tbody>
      <tr><td class="num">100+</td><td class="label en">Over Achieved</td><td style="color:#15803d; font-weight:800;">أخضر فاتح</td><td>متقدّم على الخطة، تحت الميزانية</td></tr>
      <tr><td class="num">100</td><td class="label en">On Track</td><td style="color:#15803d; font-weight:800;">أخضر</td><td>تماماً مع الخطة</td></tr>
      <tr><td class="num">90 — 99</td><td class="label en">Watch</td><td style="color:#d97706; font-weight:800;">أصفر</td><td>تحت الخطة قليلاً، يحتاج متابعة</td></tr>
      <tr><td class="num">70 — 89</td><td class="label en">At Risk</td><td style="color:#ea580c; font-weight:800;">برتقالي</td><td>متأخّر بشكل ملحوظ، يحتاج تدخّل</td></tr>
      <tr><td class="num">&lt; 70</td><td class="label en">Critical</td><td style="color:#b91c1c; font-weight:800;">أحمر</td><td>أزمة، يحتاج اجتماع عاجل</td></tr>
    </tbody>
  </table>

  <h3>أرقام للتفسير السريع</h3>
  <ul>
    <li><strong>IPI = 100:</strong> تمام، خلّص شغلك وروح البيت</li>
    <li><strong>IPI = 92:</strong> فيه شي خفيف غلط — اشيك على المكوّن الأضعف في الـ Audit</li>
    <li><strong>IPI = 78:</strong> فيه مشكلة جدّية، الـ PM لازم يطلع خطّة استدراك خلال أسبوع</li>
    <li><strong>IPI = 50:</strong> أزمة — اجتماع <em class="en-inline">Steering Committee</em> لازم</li>
  </ul>

  <h3>أين الخطر الحقيقي؟</h3>
  <p>الرقم لوحده ما يكفي. اضغط على الـ <em class="en-inline">IPI</em> → الـ <em class="en-inline">Audit Modal</em> يفتح → شف وين المشكلة:</p>
  <ul>
    <li><strong><em class="en-inline">SPI</em> منخفض:</strong> الجدول الزمني — الـ PM يحتاج يستدرك المهام المتأخّرة</li>
    <li><strong><em class="en-inline">CPI</em> منخفض:</strong> الميزانية — احتمال <em class="en-inline">scope creep</em> أو فواتير غير متوقّعة</li>
    <li><strong><em class="en-inline">MCI</em> منخفض:</strong> الوثائق — سهل، اعتمد المعلّقة</li>
    <li><strong><em class="en-inline">Penalty</em> &lt; 1.0:</strong> تجاوز <em class="en-inline">Roadmap</em> — يحتاج تعديل خطّة استراتيجية</li>
  </ul>

  <h3>متى تشكّ في الرقم؟</h3>
  <div class="callout amber">
    <h5>إشارات تستدعي تحقّق</h5>
    <p>1. الـ IPI يقفز فجأة (من 75 إلى 110) — احتمال البيانات تغيّرت بشكل مفاجئ<br>
    2. الـ Snapshot يختلف عن Time-Weighted بـ 20+ نقطة — اقرأ الـ Trend Chart<br>
    3. مشروع IPI عالي لكن متأخّر فعلياً — اشيك الأوزان والـ activities</p>
  </div>

  <div class="why">
    <h5>القاعدة الذهبية</h5>
    <p>لا ترفع رقم <em class="en-inline">IPI</em> لاجتماع تنفيذي بدون ما تفتح الـ <em class="en-inline">Audit Modal</em> أوّلاً. لو سألك <em class="en-inline">CEO</em> "ليش الرقم 88؟"، لازم يكون عندك جواب مفصّل في 30 ثانية.</p>
  </div>
  <div class="pf"><span><span class="b">IPI Personal Explainer</span></span><span>صفحة 15 · نهاية</span></div>
</div>

</body>
</html>`;

const outDir = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outHtml = path.join(outDir, "IPI-Personal-Explainer.html");
const outPdf  = path.join(outDir, "IPI-Personal-Explainer.pdf");
fs.writeFileSync(outHtml, html, "utf8");
console.log("HTML:", outHtml);

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("file:///" + outHtml.replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.pdf({
    path: outPdf, format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  const stats = fs.statSync(outPdf);
  console.log("PDF:", outPdf);
  console.log("Size:", stats.size.toLocaleString(), "bytes");
})();
