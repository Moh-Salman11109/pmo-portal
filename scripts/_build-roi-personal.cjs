// ROI personal explainer for Mohammed — student-friendly.
// English terms + glossary + no code blocks + Calculator-reproducible examples.

const fs   = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>ROI — دليل شخصي</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  :root {
    --ink:#0d1f1c; --ink-2:#2c3e3a; --muted:#5a7770;
    --line:#d1e8e4; --soft:#ecf2ed;
    --brand:#003932; --sea:#00b894; --sea-bright:#00FFB3;
    --amber:#d97706; --amber-soft:#fef3c7;
    --red:#b91c1c; --red-soft:#fee2e2;
    --green:#15803d; --green-soft:#dcfce7;
    --blue:#1e40af; --blue-soft:#dbeafe;
  }
  body {
    font-family:'Cairo',system-ui,sans-serif;
    background:#1a1a1a; color:var(--ink); line-height:1.85;
  }
  .en, .en * { font-family:'Inter',sans-serif !important; direction:ltr; unicode-bidi:embed; }
  em.i { font-family:'Inter',sans-serif; font-style:normal; font-weight:700; color:var(--brand); }

  .page {
    width:210mm; min-height:297mm;
    background:#fff;
    margin:8mm auto;
    padding:16mm 18mm;
    box-shadow:0 10px 40px rgba(0,0,0,0.35);
    page-break-after:always;
    display:flex; flex-direction:column;
  }
  .page:last-child { page-break-after:avoid; }
  @media print { body{background:#fff} .page{margin:0;box-shadow:none} @page{size:A4;margin:0} }

  /* Cover */
  .cover { background:linear-gradient(135deg,#001f1a 0%,#003932 60%,#006b56 100%); color:#fff; padding:0; }
  .cover-body { padding:44mm 22mm 28mm; flex:1; display:flex; flex-direction:column; justify-content:space-between; }
  .cover-tag { display:inline-block; padding:6px 16px; background:rgba(0,255,179,0.18); border:1px solid rgba(0,255,179,0.4); color:var(--sea-bright); border-radius:999px; font-size:10pt; font-weight:700; }
  .cover h1 { font-size:38pt; font-weight:900; line-height:1.15; margin-top:24px; color:#fff; }
  .cover h1 em { color:var(--sea-bright); font-style:normal; }
  .cover .sub { color:rgba(255,255,255,0.72); font-size:13pt; margin-top:18px; line-height:1.7; max-width:80%; }
  .cover .foot { border-top:1px solid rgba(255,255,255,0.15); padding-top:18px; display:grid; grid-template-columns:1fr 1fr; gap:18px; font-size:9pt; }
  .cover .foot .l { color:rgba(0,255,179,0.7); font-weight:700; text-transform:uppercase; font-size:8.5pt; margin-bottom:4px; }
  .cover .foot .v { color:#fff; font-size:10pt; line-height:1.6; }

  .ph { border-bottom:2px solid var(--sea); padding-bottom:8px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:baseline; }
  .ph .t { font-size:9pt; color:var(--muted); font-weight:600; }
  .ph .n { font-size:8.5pt; color:var(--brand); font-weight:700; font-family:'Inter',monospace; }

  h2.sec {
    font-size:22pt; font-weight:900; color:var(--brand);
    line-height:1.2; margin-bottom:6px;
    border-right:5px solid var(--sea); padding-right:16px;
  }
  .sec-sub { font-size:11pt; color:var(--muted); margin-bottom:18px; font-style:italic; }
  h3 { font-size:14pt; font-weight:800; color:var(--brand); margin:16px 0 8px; }
  h4 { font-size:12pt; font-weight:700; color:var(--ink-2); margin:12px 0 6px; }

  p { font-size:11pt; color:var(--ink-2); margin-bottom:8px; line-height:1.9; }
  p strong { color:var(--brand); font-weight:700; }
  ul, ol { padding-right:24px; margin-bottom:6px; }
  ul li, ol li { font-size:11pt; line-height:1.9; margin-bottom:3px; color:var(--ink-2); }

  .callout {
    background:var(--soft); border-right:4px solid var(--sea);
    padding:12px 16px; border-radius:8px; margin:10px 0;
  }
  .callout.amber { background:var(--amber-soft); border-color:var(--amber); }
  .callout.red   { background:var(--red-soft);   border-color:var(--red); }
  .callout.green { background:var(--green-soft); border-color:var(--green); }
  .callout.blue  { background:var(--blue-soft);  border-color:var(--blue); }
  .callout h5 { font-size:10pt; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:4px; }
  .callout.amber h5 { color:var(--amber); }
  .callout.red h5   { color:var(--red); }
  .callout.green h5 { color:var(--green); }
  .callout.blue h5  { color:var(--blue); }
  .callout p { font-size:10.5pt; margin:0; }

  .math {
    background:#f7fbf9;
    border:1px solid var(--line);
    border-right:4px solid var(--sea);
    border-radius:8px; padding:10px 14px; margin:8px 0;
    font-family:'Inter',sans-serif; font-size:11pt; line-height:1.9;
    direction:ltr; text-align:left; color:var(--ink);
  }
  .math .lbl { color:var(--muted); font-size:10.5pt; }
  .math .res { color:var(--brand); font-weight:800; }

  .calc {
    background:#fff; border:2px solid var(--brand);
    border-radius:10px; padding:14px 18px; margin:12px 0;
  }
  .calc .calc-h {
    background:var(--brand); color:#fff;
    margin:-14px -18px 12px; padding:8px 18px;
    border-radius:8px 8px 0 0;
    font-family:'Inter',sans-serif;
    font-size:10pt; font-weight:700; letter-spacing:0.4px;
    text-transform:uppercase;
    display:flex; justify-content:space-between;
  }
  .calc table { width:100%; }
  .calc td { padding:4px 8px; font-size:10.5pt; border-bottom:1px dashed var(--line); }
  .calc td:first-child { color:var(--muted); width:55%; }
  .calc td:last-child { font-family:'Inter',sans-serif; font-weight:700; color:var(--ink); text-align:left; direction:ltr; }
  .calc tr:last-child td { border-bottom:0; }

  .expect {
    background:linear-gradient(135deg,#003932,#001f1a);
    color:#fff; border-radius:8px; padding:12px 16px; margin:8px 0 14px;
    display:flex; justify-content:space-between; align-items:center;
  }
  .expect .l { font-size:9.5pt; color:var(--sea-bright); text-transform:uppercase; font-weight:700; letter-spacing:0.4px; }
  .expect .v { font-family:'Inter',sans-serif; font-size:16pt; font-weight:900; color:#fff; }

  table.t { width:100%; border-collapse:collapse; margin:8px 0; font-size:10.5pt; }
  table.t thead th { background:var(--brand); color:#fff; padding:8px 12px; font-weight:700; text-align:right; }
  table.t thead th:first-child { border-radius:0 6px 0 0; }
  table.t thead th:last-child { border-radius:6px 0 0 0; }
  table.t tbody td { padding:8px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
  table.t tbody tr:last-child td { border-bottom:0; }
  table.t tbody td.label { font-weight:700; color:var(--brand); }
  table.t tbody td.num { font-family:'Inter',sans-serif; font-weight:600; text-align:left; direction:ltr; }
  table.t tbody td.en { font-family:'Inter',sans-serif; direction:ltr; text-align:left; }

  .glossary { display:grid; gap:0; }
  .gloss-row { padding:11px 0; border-bottom:1px solid var(--line); }
  .gloss-row:last-child { border-bottom:0; }
  .gloss-term { font-family:'Inter',sans-serif; font-weight:800; color:var(--brand); font-size:12pt; }
  .gloss-ar { color:var(--muted); font-size:10pt; margin-right:12px; }
  .gloss-def { font-size:10.5pt; color:var(--ink-2); margin-top:4px; line-height:1.75; }

  .why {
    margin-top:14px; padding:12px 16px;
    background:linear-gradient(135deg,#001f1a,#003932);
    color:#fff; border-radius:8px; border-right:4px solid var(--sea-bright);
  }
  .why h5 { font-size:10pt; font-weight:800; color:var(--sea-bright); letter-spacing:0.4px; text-transform:uppercase; margin-bottom:5px; }
  .why p { font-size:10.5pt; color:#fff; opacity:0.92; margin:0; }

  .pf { margin-top:auto; padding-top:12px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:8.5pt; color:var(--muted); }
  .pf b { color:var(--brand); font-weight:700; }
</style>
</head>
<body>

<!-- COVER -->
<div class="page cover">
  <div class="cover-body">
    <div>
      <span class="cover-tag">دليل شخصي · مفاهيم أساسية</span>
      <h1>ROI · NPV<br>Payback · Break-even<br><em>هل المشروع يستحق؟</em></h1>
      <div class="sub">
        شرح مبسّط بالعربي — لكل مصطلح تعريف قصير، تشبيه من الحياة، ومثال جاهز
        تجرّبه في الـ <em class="en">ROI Calculator</em> في البورتل وتشوف نفس الرقم.
      </div>
    </div>
    <div class="foot">
      <div>
        <div class="l">للمستخدم</div>
        <div class="v">محمد العبدالمحسن<br>منسّق <span class="en">PMO</span></div>
      </div>
      <div>
        <div class="l">المرجع</div>
        <div class="v"><span class="en">ROI Personal Explainer</span><br>${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</div>
      </div>
    </div>
  </div>
</div>

<!-- 1. Glossary -->
<div class="page">
  <div class="ph"><span class="t">الفصل 1</span><span class="n en">ROI EXPLAINER</span></div>
  <h2 class="sec">١. فهرس المصطلحات</h2>
  <div class="sec-sub">اقرأها مرّة، بعدين ارجع لها كلما احتجت</div>

  <div class="glossary">
    <div class="gloss-row">
      <span class="gloss-term">ROI</span>
      <span class="gloss-ar">Return on Investment — العائد على الاستثمار</span>
      <div class="gloss-def">نسبة الربح على تكلفة المشروع. <strong>مثال:</strong> صرفت 3 مليون، رجع لك 9 مليون فوائد على 5 سنوات → ROI = 200%.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">Payback Period</span>
      <span class="gloss-ar">فترة استرداد رأس المال</span>
      <div class="gloss-def"><strong>كم شهر تحتاج لتسترد تكلفة المشروع من الفوائد؟</strong> مثال: صرفت 3M، والفائدة شهرياً 150K → Payback = 20 شهر.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">Break-even Date</span>
      <span class="gloss-ar">تاريخ التعادل</span>
      <div class="gloss-def">اليوم اللي فيه المشروع يقفل حساباته مع نفسه — <strong>لا خسارة ولا ربح</strong>. بعده كل ريال = ربح صافي.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">NPV</span>
      <span class="gloss-ar">Net Present Value — القيمة الحالية الصافية</span>
      <div class="gloss-def">قيمة كل الفوائد المستقبلية <strong>محسوبة كأنها اليوم</strong>. لأن ريال في 2030 يساوي أقل من ريال اليوم (بسبب التضخّم). NPV موجب = المشروع يخلق قيمة.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">Discount Rate</span>
      <span class="gloss-ar">معدّل الخصم</span>
      <div class="gloss-def">النسبة اللي "نخصم" فيها قيمة الريال المستقبلي. عادةً 8% (معدّل تري الداخلي). كل ما زادت، كل ما نزلت قيمة الفوائد البعيدة.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">Horizon</span>
      <span class="gloss-ar">أفق التحليل</span>
      <div class="gloss-def">كم سنة بعد المشروع تريد تحسب فيها الفوائد. الافتراضي 5 سنوات. مشاريع تقنية سريعة التقادم → 3. مشاريع كبيرة مستقرة → 7-10.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">Implementation Duration</span>
      <span class="gloss-ar">مدة التنفيذ</span>
      <div class="gloss-def">كم شهر يحتاج المشروع نفسه قبل ما يبدأ يعطي فوائد. مثلاً: بناء نظام يحتاج 8 شهور، ثم يبدأ التوفير من الشهر التاسع.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">Annual Benefit</span>
      <span class="gloss-ar">الفائدة السنوية</span>
      <div class="gloss-def">التوفير أو الإيراد اللي يجيبه المشروع كل سنة بعد الإطلاق. <strong>مثال:</strong> أتمتة عملية توفّر 5 موظّفين بـ 300K راتب سنوي كل واحد = 1.5M فائدة سنوية.</div>
    </div>
    <div class="gloss-row">
      <span class="gloss-term">Verdict</span>
      <span class="gloss-ar">الحكم</span>
      <div class="gloss-def">تصنيف تلقائي: Strong / Acceptable / Marginal / Weak — بناءً على Payback + ROI. مش قرار نهائي، بس مؤشّر أوّلي.</div>
    </div>
  </div>

  <div class="pf"><span><b>ROI Explainer</b></span><span>ص. 2</span></div>
</div>

<!-- 2. ROI -->
<div class="page">
  <div class="ph"><span class="t">الفصل 2</span><span class="n en">ROI EXPLAINER</span></div>
  <h2 class="sec">٢. <span class="en">ROI</span> — العائد على الاستثمار</h2>
  <div class="sec-sub">أهم رقم في أي قرار مشروع</div>

  <h3>الفكرة في سطر</h3>
  <div class="callout green">
    <p style="font-size:13pt"><strong>ROI = (إجمالي الفوائد − التكلفة) ÷ التكلفة × 100%</strong></p>
  </div>

  <h3>تشبيه: الاستثمار في محل بقالة</h3>
  <p>افتتحت محل بقالة بـ <strong>100,000 ريال</strong>. على 5 سنوات، جنيت أرباح صافية <strong>300,000 ريال</strong>. كم ROI؟</p>
  <div class="math">
    <span class="lbl">إجمالي الأرباح:</span> 300,000<br>
    <span class="lbl">التكلفة الأصلية:</span> 100,000<br>
    <span class="lbl">الربح فوق التكلفة:</span> 300,000 − 100,000 = 200,000<br>
    <span class="res">ROI = 200,000 ÷ 100,000 × 100% = 200%</span>
  </div>
  <p>يعني كل ريال حطّيته، رجع لك ريالين ربح إضافي.</p>

  <h3>مثال جاهز للـ <em class="en">Calculator</em></h3>
  <div class="calc">
    <div class="calc-h"><span>مشروع أتمتة</span><span class="en">ROI Calculator</span></div>
    <table>
      <tr><td>Total project cost</td><td>3,000,000 SAR</td></tr>
      <tr><td>Expected annual benefit</td><td>1,800,000 SAR</td></tr>
      <tr><td>Duration</td><td>8 months</td></tr>
      <tr><td>Horizon</td><td>5 years</td></tr>
      <tr><td>Discount rate</td><td>8%</td></tr>
    </table>
  </div>
  <div class="math">
    <span class="lbl">فترة الفوائد الفعلية:</span> 5 − (8÷12) = 4.33 سنة<br>
    <span class="lbl">إجمالي الفوائد:</span> 1,800,000 × 4.33 = 7,800,000<br>
    <span class="lbl">الربح:</span> 7,800,000 − 3,000,000 = 4,800,000<br>
    <span class="res">ROI = 4,800,000 ÷ 3,000,000 × 100% = 160%</span>
  </div>
  <div class="expect">
    <span class="l">الـ Calculator راح يعرض</span>
    <span class="v">ROI = +160%</span>
  </div>

  <h3>كيف تقرأ الرقم؟</h3>
  <ul>
    <li><strong>ROI &gt; 100%</strong> = المشروع أعطى ضعف تكلفته أرباحاً</li>
    <li><strong>ROI = 0%</strong> = تعادل — استرجعت التكلفة فقط</li>
    <li><strong>ROI &lt; 0%</strong> = خسارة — الفوائد أقل من التكلفة</li>
  </ul>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>ROI رقم واحد يقارن مشاريع مختلفة. لو عندك خيارين — أ (ROI 200%) و ب (ROI 50%) — أ أفضل. أهم رقم لأي steering committee.</p>
  </div>

  <div class="pf"><span><b>ROI Explainer</b></span><span>ص. 3</span></div>
</div>

<!-- 3. Payback -->
<div class="page">
  <div class="ph"><span class="t">الفصل 3</span><span class="n en">ROI EXPLAINER</span></div>
  <h2 class="sec">٣. <span class="en">Payback Period</span> — فترة الاسترداد</h2>
  <div class="sec-sub">كم شهر لتسترد كل ريال صرفته</div>

  <h3>الفكرة في سطر</h3>
  <div class="callout green">
    <p style="font-size:13pt"><strong>Payback = التكلفة الكلية ÷ الفائدة الشهرية</strong></p>
  </div>

  <h3>تشبيه: تركيب ألواح طاقة شمسية في بيتك</h3>
  <p>ركّبت ألواح شمسية بـ <strong>24,000 ريال</strong>. فاتورة الكهرباء نزلت <strong>1,000 ريال شهرياً</strong>.</p>
  <div class="math">
    <span class="res">Payback = 24,000 ÷ 1,000 = 24 شهر</span>
  </div>
  <p>يعني بعد <strong>سنتين</strong>، رجعت تكلفة الألواح. من الشهر الـ 25 وطالع، أي وفر = ربح صافي.</p>

  <h3>مثال جاهز للـ <em class="en">Calculator</em></h3>
  <div class="calc">
    <div class="calc-h"><span>نفس مشروع الأتمتة</span><span class="en">ROI Calculator</span></div>
    <table>
      <tr><td>Total project cost</td><td>3,000,000 SAR</td></tr>
      <tr><td>Expected annual benefit</td><td>1,800,000 SAR</td></tr>
      <tr><td>Duration</td><td>8 months</td></tr>
    </table>
  </div>
  <div class="math">
    <span class="lbl">فائدة شهرية:</span> 1,800,000 ÷ 12 = 150,000<br>
    <span class="lbl">Payback بعد الإطلاق:</span> 3,000,000 ÷ 150,000 = 20 شهر<br>
    <span class="res">إجمالي من اليوم = 8 شهر تنفيذ + 20 شهر استرداد = 28 شهر</span>
  </div>
  <div class="expect">
    <span class="l">الـ Calculator راح يعرض</span>
    <span class="v">Payback = 20m</span>
  </div>

  <h3>كيف تقرأه؟</h3>
  <table class="t">
    <thead><tr><th>Payback</th><th>الحكم</th></tr></thead>
    <tbody>
      <tr><td class="num">≤ 12 شهر</td><td>ممتاز — الأولوية القصوى</td></tr>
      <tr><td class="num">12 – 24 شهر</td><td>قوي — عادةً يوافق</td></tr>
      <tr><td class="num">24 – 36 شهر</td><td>مقبول — يحتاج مبرّرات إضافية</td></tr>
      <tr><td class="num">36 – 60 شهر</td><td>ضعيف — راجع الفوائد</td></tr>
      <tr><td class="num">&gt; 60 شهر</td><td>حرج — عادةً يُرفض</td></tr>
    </tbody>
  </table>

  <div class="callout amber">
    <h5>تحفّظ مهم</h5>
    <p>Payback ما يشوف اللي بعد نقطة الاسترداد. مشروع payback = 20 شهر مع فوائد لسنة واحدة فقط أسوأ من مشروع payback = 30 شهر مع فوائد لـ 10 سنوات. لذلك <strong>لا تستخدم Payback وحده</strong> — استخدمه مع ROI و NPV.</p>
  </div>

  <div class="pf"><span><b>ROI Explainer</b></span><span>ص. 4</span></div>
</div>

<!-- 4. Break-even -->
<div class="page">
  <div class="ph"><span class="t">الفصل 4</span><span class="n en">ROI EXPLAINER</span></div>
  <h2 class="sec">٤. <span class="en">Break-even Date</span> — تاريخ التعادل</h2>
  <div class="sec-sub">اليوم اللي المشروع يوقف الخسارة</div>

  <h3>الفكرة في سطر</h3>
  <div class="callout green">
    <p style="font-size:13pt"><strong>Break-even = تاريخ اليوم + مدة التنفيذ + Payback</strong></p>
  </div>

  <p>الفرق بين <em class="en">Payback</em> و <em class="en">Break-even</em>:</p>
  <ul>
    <li><strong>Payback</strong> = <em>عدد الأشهر</em> اللي يحتاجها المشروع للاسترداد</li>
    <li><strong>Break-even</strong> = <em>التاريخ الفعلي</em> على التقويم</li>
  </ul>

  <h3>مثال</h3>
  <p>لو اليوم <strong>6 يوليو 2026</strong>، ومشروعك:</p>
  <ul>
    <li>مدة التنفيذ: <strong>8 شهور</strong> (يبدأ يعطي فوائد في مارس 2027)</li>
    <li>Payback: <strong>20 شهر</strong> بعد الإطلاق</li>
  </ul>
  <div class="math">
    <span class="lbl">اليوم:</span> 6 يوليو 2026<br>
    <span class="lbl">+ 8 شهور تنفيذ:</span> 6 مارس 2027<br>
    <span class="lbl">+ 20 شهر استرداد:</span> 6 نوفمبر 2028<br>
    <span class="res">Break-even Date = November 2028</span>
  </div>
  <div class="expect">
    <span class="l">الـ Calculator راح يعرض</span>
    <span class="v">Break-even: Nov 2028</span>
  </div>

  <h3>ليش تاريخ مش شهور؟</h3>
  <p><strong>لأن التنفيذيين يفكّرون بالتقويم، مش بالشهور المجرّدة.</strong> "المشروع يوقف الخسارة في نوفمبر 2028" أوضح من "بعد 28 شهر".</p>
  <p>يستخدم في:</p>
  <ul>
    <li>عرض للـ Board — "متى نبدأ نحسّ بالفائدة؟"</li>
    <li>تخطيط الميزانية — "متى نتوقّف عن ضخ رأس مال؟"</li>
    <li>مراجعة الأداء — "وصلنا النقطة أو لسه؟"</li>
  </ul>

  <div class="why">
    <h5>ليش يهمّك</h5>
    <p>Break-even Date = <strong>نقطة قياس ملموسة</strong>. لو دخلت تلك النقطة والمشروع لسه لم يعادل، فيه خلل في الفوائد المتوقّعة. راجع فوراً.</p>
  </div>

  <div class="pf"><span><b>ROI Explainer</b></span><span>ص. 5</span></div>
</div>

<!-- 5. NPV -->
<div class="page">
  <div class="ph"><span class="t">الفصل 5</span><span class="n en">ROI EXPLAINER</span></div>
  <h2 class="sec">٥. <span class="en">NPV</span> — القيمة الحالية الصافية</h2>
  <div class="sec-sub">أعقد المفاهيم — بس أهمّها للـ Executives</div>

  <h3>الفكرة في سطر</h3>
  <div class="callout green">
    <p style="font-size:13pt"><strong>NPV = قيمة الفوائد المستقبلية "كأنها اليوم" − التكلفة</strong></p>
  </div>

  <h3>ليش نحتاج NPV؟ — قيمة الوقت للمال</h3>
  <p>سؤال بسيط: <strong>هل تفضّل 1 مليون ريال الآن، أم 1 مليون ريال بعد 5 سنوات؟</strong></p>
  <p>طبعاً الآن. ليش؟</p>
  <ul>
    <li><strong>التضخّم:</strong> الريال يفقد قيمته الشرائية</li>
    <li><strong>الفرصة البديلة:</strong> تقدر تستثمره الآن وتربح</li>
    <li><strong>المخاطرة:</strong> فيه احتمال ما يوصل بعد 5 سنوات</li>
  </ul>
  <p><strong>لذلك:</strong> 1 مليون بعد 5 سنوات = أقل من 1 مليون الآن. NPV يحسب كم بالضبط.</p>

  <h3>الصيغة (بلغة إنسان)</h3>
  <div class="math">
    <span class="lbl">قيمة اليوم لفائدة بعد سنة:</span> الفائدة ÷ (1 + معدّل الخصم)^1<br>
    <span class="lbl">قيمة اليوم لفائدة بعد سنتين:</span> الفائدة ÷ (1 + معدّل الخصم)^2<br>
    <span class="lbl">... وهكذا لكل سنة في الأفق</span><br>
    <span class="res">NPV = مجموع كل هذي القيم − التكلفة</span>
  </div>

  <h3>مثال بسيط</h3>
  <p>مشروع كلفته 1,000,000 اليوم، فوائد 300,000 سنوياً لـ 5 سنوات، معدّل خصم 8%:</p>
  <table class="t">
    <thead><tr><th>السنة</th><th>الفائدة الاسمية</th><th>القيمة الحالية</th></tr></thead>
    <tbody>
      <tr><td class="num">1</td><td class="num">300,000</td><td class="num">277,778</td></tr>
      <tr><td class="num">2</td><td class="num">300,000</td><td class="num">257,201</td></tr>
      <tr><td class="num">3</td><td class="num">300,000</td><td class="num">238,149</td></tr>
      <tr><td class="num">4</td><td class="num">300,000</td><td class="num">220,509</td></tr>
      <tr><td class="num">5</td><td class="num">300,000</td><td class="num">204,175</td></tr>
      <tr><td class="label" colspan="2">مجموع القيم الحالية</td><td class="num" style="font-weight:800">1,197,812</td></tr>
    </tbody>
  </table>
  <div class="math">
    <span class="res">NPV = 1,197,812 − 1,000,000 = +197,812 SAR</span>
  </div>

  <h3>كيف تقرأ NPV؟</h3>
  <ul>
    <li><strong>NPV موجب</strong> (+) = المشروع يخلق قيمة → افعل</li>
    <li><strong>NPV = صفر</strong> = تعادل → قرار حسب معايير أخرى</li>
    <li><strong>NPV سالب</strong> (−) = المشروع يدمّر قيمة → لا تفعل</li>
  </ul>

  <div class="callout amber">
    <h5>تنبيه</h5>
    <p>NPV حسّاس جداً للـ Discount Rate. لو ترفعه من 8% لـ 12%، الـ NPV ينخفض كثير. اختر معدّل واقعي — عادةً معدّل تمويل الشركة أو عائدها المطلوب.</p>
  </div>

  <div class="pf"><span><b>ROI Explainer</b></span><span>ص. 6</span></div>
</div>

<!-- 6. Horizon + Discount -->
<div class="page">
  <div class="ph"><span class="t">الفصل 6</span><span class="n en">ROI EXPLAINER</span></div>
  <h2 class="sec">٦. <span class="en">Horizon</span> &amp; <span class="en">Discount Rate</span></h2>
  <div class="sec-sub">المتغيّرات اللي "تلوّن" النتيجة — احذر من الغش الذاتي</div>

  <h3>Horizon (الأفق الزمني)</h3>
  <p>كم سنة بعد المشروع تريد تحسب فيها الفوائد. الافتراضي 5.</p>

  <table class="t">
    <thead><tr><th>Horizon</th><th>مناسب لـ</th><th>لماذا</th></tr></thead>
    <tbody>
      <tr><td class="num">3 سنوات</td><td>تطبيقات موبايل، مواقع، أدوات إنتاجية</td><td>التقنية تتقادم بسرعة</td></tr>
      <tr><td class="num" style="background:#f0f9f4">5 سنوات ⭐</td><td>معظم مشاريع IT، أنظمة داخلية</td><td>الافتراضي والأكثر شيوعاً</td></tr>
      <tr><td class="num">7 سنوات</td><td>ERP، بنية تحتية، خوادم</td><td>عمر تشغيلي أطول</td></tr>
      <tr><td class="num">10 سنوات</td><td>Data centers، تحوّل رقمي جوهري</td><td>استثمارات استراتيجية</td></tr>
    </tbody>
  </table>

  <div class="callout red">
    <h5>غش يجب تجنّبه</h5>
    <p>لا تختر horizon طويل جداً عشان "تلوّن" الـ ROI. لو المشروع تقنياً بيتقادم في 3 سنوات، اختيار 10 سنوات = وهم. الإدارة راح تشوف الرقم الحلو، ثم تكتشف إن المشروع ما نفع وقت اللزوم. <strong>كن واقعياً.</strong></p>
  </div>

  <h3>Discount Rate (معدّل الخصم)</h3>
  <p>النسبة اللي تخصم فيها قيمة الفوائد المستقبلية. عندنا الافتراضي 8%.</p>

  <table class="t">
    <thead><tr><th>المعدّل</th><th>يمثّل ماذا</th></tr></thead>
    <tbody>
      <tr><td class="num">0%</td><td>تجاهل قيمة الوقت للمال (غير واقعي)</td></tr>
      <tr><td class="num">5-6%</td><td>مشاريع منخفضة المخاطر أو حكومية</td></tr>
      <tr><td class="num" style="background:#f0f9f4">8% ⭐</td><td>الافتراضي — معدّل تري الداخلي</td></tr>
      <tr><td class="num">10-12%</td><td>مشاريع أعلى مخاطرة</td></tr>
      <tr><td class="num">15%+</td><td>مشاريع تجريبية / رأس مال مغامر</td></tr>
    </tbody>
  </table>

  <h3>مقارنة تأثير كل واحد</h3>
  <p>نفس المشروع (3M تكلفة، 1.8M فائدة سنوية، 8 شهور تنفيذ):</p>

  <table class="t">
    <thead><tr><th>Horizon</th><th>Discount</th><th>ROI</th><th>NPV</th><th>الحكم</th></tr></thead>
    <tbody>
      <tr><td class="num">3</td><td class="num">8%</td><td class="num">+41%</td><td class="num" style="color:#059669">+935K</td><td>مقبول</td></tr>
      <tr><td class="num">5</td><td class="num">8%</td><td class="num">+160%</td><td class="num" style="color:#059669">+3.9M</td><td>قوي</td></tr>
      <tr><td class="num">5</td><td class="num">12%</td><td class="num">+160%</td><td class="num" style="color:#059669">+2.8M</td><td>قوي (أقل)</td></tr>
      <tr><td class="num">10</td><td class="num">8%</td><td class="num">+460%</td><td class="num" style="color:#059669">+8.4M</td><td>قوي جداً</td></tr>
    </tbody>
  </table>

  <div class="callout blue">
    <h5>القاعدة</h5>
    <p><strong>ROI ما يتأثّر بالـ Discount</strong> (يقيس الأرقام الاسمية). <strong>NPV يتأثّر بالاثنين</strong>. لذلك NPV أدقّ.</p>
  </div>

  <div class="pf"><span><b>ROI Explainer</b></span><span>ص. 7</span></div>
</div>

<!-- 7. Full worked example -->
<div class="page">
  <div class="ph"><span class="t">الفصل 7</span><span class="n en">ROI EXPLAINER</span></div>
  <h2 class="sec">٧. مثال كامل — خطوة بخطوة</h2>
  <div class="sec-sub">جرّبه في الـ Calculator وقارن</div>

  <h3>السيناريو</h3>
  <p>الـ PMO يفكّر ينفّذ نظام أتمتة للـ Claims Processing. المعطيات:</p>

  <div class="calc">
    <div class="calc-h"><span>Claims Automation System</span><span class="en">ROI Calculator</span></div>
    <table>
      <tr><td>Total project cost</td><td>3,000,000 SAR</td></tr>
      <tr><td>Expected annual benefit</td><td>1,800,000 SAR</td></tr>
      <tr><td>Implementation duration</td><td>8 months</td></tr>
      <tr><td>Analysis horizon</td><td>5 years</td></tr>
      <tr><td>Discount rate</td><td>8%</td></tr>
    </table>
  </div>

  <h3>الخطوة 1 — Payback</h3>
  <div class="math">
    <span class="lbl">Monthly benefit:</span> 1,800,000 ÷ 12 = 150,000<br>
    <span class="res">Payback = 3,000,000 ÷ 150,000 = 20 months</span>
  </div>

  <h3>الخطوة 2 — Break-even Date</h3>
  <div class="math">
    <span class="lbl">اليوم + 8 شهور تنفيذ:</span> مارس 2027<br>
    <span class="lbl">+ 20 شهر Payback:</span><br>
    <span class="res">Break-even = November 2028</span>
  </div>

  <h3>الخطوة 3 — ROI</h3>
  <div class="math">
    <span class="lbl">فترة الفوائد الفعلية:</span> 5 − (8÷12) = 4.33 سنة<br>
    <span class="lbl">إجمالي الفوائد:</span> 1,800,000 × 4.33 = 7,800,000<br>
    <span class="res">ROI = (7,800,000 − 3,000,000) ÷ 3,000,000 = +160%</span>
  </div>

  <h3>الخطوة 4 — NPV</h3>
  <div class="math">
    <span class="lbl">مجموع القيم الحالية للفوائد على 4.33 سنة عند 8%:</span> ~6.5M<br>
    <span class="res">NPV = 6.5M − 3M = +3.5M SAR</span>
  </div>

  <h3>الخطوة 5 — Verdict</h3>
  <div class="expect">
    <span class="l">Payback ≤ 24m + ROI ≥ 100%</span>
    <span class="v">Strong ✓</span>
  </div>

  <h3>القرار</h3>
  <div class="callout green">
    <h5>توصية</h5>
    <p>المشروع يستحق التنفيذ. يسترد كلفته في أقل من سنتين، يعطي 160% ربح على 5 سنوات، ويخلق 3.5M SAR من القيمة الحالية الصافية. رفعه للـ Steering Committee مع البيانات.</p>
  </div>

  <div class="why">
    <h5>جرّبه بيدك</h5>
    <p>افتح البورتل → <em class="en">What-If Tools</em> → <em class="en">ROI Calculator</em> → ادخل نفس الأرقام. راح تشوف نفس النتائج بالضبط. لو ما طابق، خذ screenshot وقول لي — راح أعرف وين الخلل.</p>
  </div>

  <div class="pf"><span><b>ROI Explainer</b> · نهاية الوثيقة</span><span>ص. 8</span></div>
</div>

</body>
</html>`;

const outDir = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outHtml = path.join(outDir, "ROI-Personal-Explainer.html");
const outPdf  = path.join(outDir, "ROI-Personal-Explainer.pdf");
fs.writeFileSync(outHtml, html, "utf8");
console.log("HTML:", outHtml);

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("file:///" + outHtml.replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.pdf({
    path: outPdf, format: "A4",
    printBackground: true, preferCSSPageSize: true,
    margin: { top:0, right:0, bottom:0, left:0 },
  });
  await browser.close();
  const stats = fs.statSync(outPdf);
  console.log("PDF:", outPdf);
  console.log("Size:", stats.size.toLocaleString(), "bytes");
})();
