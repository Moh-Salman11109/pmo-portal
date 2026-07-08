// Testing explained for Mohammed — from zero. No jargon.
// Personal doc — Cairo font. English terms with Arabic explanation.
// Real stories from his own portal.

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Testing — دليل شخصي من الصفر</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
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
  code {
    font-family:'JetBrains Mono',monospace;
    background:var(--soft); padding:1px 6px; border-radius:4px;
    font-size:10pt; color:var(--brand);
  }

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
  @media print {
    body{background:#fff} .page{margin:0;box-shadow:none} @page{size:A4;margin:0}
  }

  /* COVER */
  .cover {
    background:linear-gradient(135deg,#001f1a 0%,#003932 60%,#006b56 100%);
    color:#fff; padding:0;
  }
  .cover-body {
    padding:45mm 22mm 30mm; flex:1;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  .cover-tag {
    display:inline-block; padding:6px 16px;
    background:rgba(0,255,179,0.18); border:1px solid rgba(0,255,179,0.4);
    color:var(--sea-bright); border-radius:999px;
    font-size:10pt; font-weight:700;
  }
  .cover h1 { font-size:38pt; font-weight:900; line-height:1.15; margin-top:24px; color:#fff; }
  .cover h1 em { color:var(--sea-bright); font-style:normal; }
  .cover .sub {
    color:rgba(255,255,255,0.72); font-size:13pt; margin-top:18px;
    line-height:1.7; max-width:80%;
  }
  .cover .foot {
    border-top:1px solid rgba(255,255,255,0.15); padding-top:18px;
    display:grid; grid-template-columns:1fr 1fr; gap:18px; font-size:9pt;
  }
  .cover .foot .l {
    color:rgba(0,255,179,0.7); font-weight:700;
    text-transform:uppercase; font-size:8.5pt; margin-bottom:4px;
  }
  .cover .foot .v { color:#fff; font-size:10pt; line-height:1.6; }

  .ph {
    border-bottom:2px solid var(--sea); padding-bottom:8px; margin-bottom:20px;
    display:flex; justify-content:space-between; align-items:baseline;
  }
  .ph .t { font-size:9pt; color:var(--muted); font-weight:600; letter-spacing:0.3px; }
  .ph .n { font-size:8.5pt; color:var(--brand); font-weight:700; }

  h2.sec {
    font-size:22pt; font-weight:900; color:var(--brand);
    line-height:1.2; margin-bottom:6px;
    border-right:5px solid var(--sea); padding-right:16px;
  }
  .sec-sub { font-size:11.5pt; color:var(--muted); margin-bottom:18px; font-style:italic; }

  h3 { font-size:14pt; font-weight:800; color:var(--brand); margin:18px 0 8px; }

  p { font-size:11pt; color:var(--ink-2); margin-bottom:10px; line-height:1.95; }
  p strong { color:var(--brand); font-weight:700; }
  ul, ol { padding-right:24px; margin-bottom:6px; }
  ul li, ol li { font-size:11pt; line-height:1.95; margin-bottom:4px; color:var(--ink-2); }

  .callout {
    background:var(--soft); border-right:4px solid var(--sea);
    padding:12px 16px; border-radius:8px; margin:12px 0;
  }
  .callout.amber { background:var(--amber-soft); border-color:var(--amber); }
  .callout.red   { background:var(--red-soft);   border-color:var(--red); }
  .callout.green { background:var(--green-soft); border-color:var(--green); }
  .callout.blue  { background:var(--blue-soft);  border-color:var(--blue); }
  .callout h5 {
    font-size:10pt; font-weight:800; letter-spacing:0.3px;
    text-transform:uppercase; margin-bottom:4px;
  }
  .callout.amber h5 { color:var(--amber); }
  .callout.red h5   { color:var(--red); }
  .callout.green h5 { color:var(--green); }
  .callout.blue h5  { color:var(--blue); }
  .callout p { font-size:10.5pt; margin:0; }

  .story {
    background:#f7fbf9;
    border:1px solid var(--line);
    border-right:4px solid var(--brand);
    border-radius:8px; padding:14px 18px; margin:14px 0;
  }
  .story .title {
    font-size:10.5pt; color:var(--brand); font-weight:800;
    text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;
  }
  .story p { font-size:11pt; margin-bottom:6px; }

  table { width:100%; border-collapse:collapse; margin:10px 0; font-size:10.5pt; }
  th { background:var(--brand); color:#fff; text-align:right; padding:8px 12px; font-weight:700; }
  th:first-child { border-radius:0 6px 0 0; }
  th:last-child { border-radius:6px 0 0 0; }
  td { padding:8px 12px; border-bottom:1px solid var(--line); vertical-align:top; color:var(--ink-2); }
  tr:last-child td { border-bottom:0; }
  td.label { font-weight:700; color:var(--brand); }

  .glossary { display:grid; gap:0; }
  .gloss-row { padding:12px 0; border-bottom:1px solid var(--line); }
  .gloss-row:last-child { border-bottom:0; }
  .gloss-term {
    font-family:'Inter',sans-serif; font-weight:800; color:var(--brand); font-size:12.5pt;
  }
  .gloss-def { font-size:11pt; color:var(--ink-2); margin-top:5px; line-height:1.8; }

  .why {
    margin-top:18px; padding:14px 18px;
    background:linear-gradient(135deg,#001f1a,#003932);
    color:#fff; border-radius:8px; border-right:4px solid var(--sea-bright);
  }
  .why h5 {
    font-size:10pt; font-weight:800; color:var(--sea-bright);
    letter-spacing:0.4px; text-transform:uppercase; margin-bottom:6px;
  }
  .why p { font-size:11pt; color:#fff; opacity:0.92; margin:0; }

  .cheat {
    background:var(--soft); border:2px solid var(--sea);
    border-radius:12px; padding:20px 24px; margin:12px 0;
  }
  .cheat .cheat-title {
    font-size:11pt; font-weight:800; color:var(--brand);
    text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;
  }
  .cheat .cmd {
    background:var(--brand); color:#ccfff0;
    padding:10px 14px; border-radius:6px; margin:8px 0;
    font-family:'JetBrains Mono',monospace; font-size:11pt;
    direction:ltr; text-align:left;
    display:flex; justify-content:space-between; align-items:center;
  }
  .cheat .cmd .what {
    color:rgba(255,255,255,0.55); font-size:9pt;
    font-family:'Cairo',sans-serif;
  }

  .pf {
    margin-top:auto; padding-top:14px; border-top:1px solid var(--line);
    display:flex; justify-content:space-between; font-size:8.5pt; color:var(--muted);
  }
  .pf b { color:var(--brand); font-weight:700; }
</style>
</head>
<body>

<!-- ─── COVER ─── -->
<div class="page cover">
  <div class="cover-body">
    <div>
      <span class="cover-tag">دليل شخصي · للمبتدئ من الصفر</span>
      <h1>Testing<br><em>مافهم شي أصلاً</em></h1>
      <div class="sub">
        شرح مبسّط جداً بلغة الحياة اليومية — بدون لغة برمجة، بدون مصطلحات، بدون افتراضات.
        فقط: ما هو testing؟ ليش موجود؟ متى تستخدمه؟ ومتى تتجاهله؟
        <br><br>
        بأمثلة حقيقية من بورتلك أنت — مش أمثلة نظرية.
      </div>
    </div>
    <div class="foot">
      <div>
        <div class="l">للمستخدم</div>
        <div class="v">محمد العبدالمحسن<br>منسّق <span class="en">PMO</span></div>
      </div>
      <div>
        <div class="l">المرجع</div>
        <div class="v">Testing 101<br>${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</div>
      </div>
    </div>
  </div>
</div>

<!-- ─── PAGE 1 — الفكرة الجوهرية ─── -->
<div class="page">
  <div class="ph"><span class="t">الفصل 1</span><span class="n en">TESTING 101</span></div>
  <h2 class="sec">١. الفكرة كلها في سطر واحد</h2>
  <div class="sec-sub">اقرأ هذا السطر فقط — لو نسيت كل شي، تذكّر هذا</div>

  <div class="callout green">
    <p style="font-size:14pt; line-height:1.7">
      <strong><span class="en">Test</span> = اختبار آلي يتحقّق إن جزء من الكود يشتغل صح، بدون ما تفتح البورتل وتجرّبه يدوياً.</strong>
    </p>
  </div>

  <h3>تشبيه بسيط: مفتّش الجودة في المصنع</h3>
  <p>تخيّل مصنع سيارات. كل ساعة، تخرج سيارة من خط الإنتاج. قبل ما توصل للزبون، فيه <strong>مفتّش جودة</strong> يشيك عليها:</p>
  <ul>
    <li>يشتغل المكيّف؟ ✓ أو ✗</li>
    <li>الفرامل تشتغل؟ ✓ أو ✗</li>
    <li>الأنوار تنوّر؟ ✓ أو ✗</li>
  </ul>
  <p>لو أي شي فشل (✗)، السيارة ما تخرج للزبون. تروح للتصليح أوّل.</p>

  <p><strong>الـ <em class="i">Tests</em> في كود بورتلك هي نفس الفكرة:</strong></p>
  <ul>
    <li>لو تحسب <em class="i">IPI</em> لمشروع خلّص متأخّر، هل الرقم صحيح؟ ✓ أو ✗</li>
    <li>لو تاريخ البداية بعد تاريخ النهاية، هل الـ engine يرفض الحساب؟ ✓ أو ✗</li>
    <li>لو ما فيه ميزانية، هل <em class="i">CPI</em> ينحسب صفر أو يُستبعد؟ ✓ أو ✗</li>
  </ul>

  <p>كل ✗ = المصنع ما يخرج المنتج للزبون. يطلع خبر: "فيه شي مكسور، صلّحه أوّل."</p>

  <div class="callout blue">
    <h5>لاحظ</h5>
    <p>المفتّش ما يبني السيارة. هو يتأكّد إن السيارة اللي بنيت صح. نفس الشي، الـ tests ما تكتب الكود — تتأكّد إن الكود المكتوب يشتغل صح.</p>
  </div>

  <div class="pf"><span><b>Testing 101</b> · للمستخدم فقط</span><span>صفحة 1</span></div>
</div>

<!-- ─── PAGE 2 — ليش موجودة أصلاً ─── -->
<div class="page">
  <div class="ph"><span class="t">الفصل 2</span><span class="n en">TESTING 101</span></div>
  <h2 class="sec">٢. طيب ليش نحتاجها أصلاً؟</h2>
  <div class="sec-sub">الجواب الأصدق: عشان ما يرجع الـ bug اللي صلّحته أمس</div>

  <p>هذا السؤال أهم من كل شي. الجواب مش نظري — قصص حقيقية من بورتلك:</p>

  <div class="story">
    <div class="title">قصة حقيقية 1 · قبل شهر</div>
    <p><strong>قبل الإصلاح:</strong> لو مشروع خلّص متأخّر (100% progress بعد الـ <em class="en">Planned End</em> بشهرين)، الـ <em class="i">IPI</em> كان يطلع <strong>100 "On Track"</strong>. غلط منطقياً — المشروع متأخّر مو مثالي.</p>
    <p><strong>الإصلاح:</strong> عدّلت الـ engine بحيث الـ <em class="en">PV</em> يستمر يكبر بعد الـ <em class="en">Planned End</em>. المشروع المتأخّر الآن يطلع <em class="i">IPI</em> = 60.</p>
    <p><strong>الخطر:</strong> بكرا، حد يعدّل الكود ويرجع الـ bug بدون قصد. كيف نضمن إنه ما يرجع؟</p>
    <p><strong>الحل: <em class="i">Test</em>.</strong> كتبنا اختبار يقول: "لو مشروع خلّص متأخّر شهرين، <em class="i">IPI</em> لازم يكون أقل من 70." لو أحد كسّر الـ engine بغلط، هذا الاختبار راح يفشل فوراً — قبل ما الغلط يوصل للإنتاج.</p>
  </div>

  <div class="story">
    <div class="title">قصة حقيقية 2 · قبل أسبوعين</div>
    <p><strong>مشكلة قديمة:</strong> لو الـ <em class="en">PM</em> ما دخّل بيانات التكلفة (<em class="en">actualCost</em>)، الـ <em class="i">CPI</em> كان يُعامَل كـ 1.0 (محايد). النتيجة: الـ <em class="en">PM</em> يقدر يخبّي بيانات ويطلع IPI عالي زايف.</p>
    <p><strong>الإصلاح:</strong> null الآن يُستبعَد، والأوزان يُعاد حسابها.</p>
    <p><strong>Test الحماية:</strong> "لو <em class="en">PM</em> يخبّي بيانات التكلفة، <em class="i">IPI</em> ما يجوز يكون أعلى من مشروع فيه بيانات تكلفة سيئة." هذا الاختبار **دائماً موجود** ويحرس ضد رجوع الـ bug.</p>
  </div>

  <div class="callout amber">
    <h5>الفكرة الأساسية</h5>
    <p>كل مرّة تصلّح <em class="en">bug</em>، اكتب <em class="i">test</em> يمنع رجوعه. اسمها في الصناعة <strong>Regression Test</strong> — يعني "اختبار ضد التراجع."</p>
  </div>

  <h3>بدون <em class="i">tests</em>، وش يصير؟</h3>
  <p>سيناريو حقيقي جداً:</p>
  <ol>
    <li>يوم الاثنين: أنت تصلّح <em class="en">bug</em> في الـ engine</li>
    <li>يوم الأربعاء: <em class="en">Ahmed</em> يعدّل جزء ثاني، بدون قصد يكسّر إصلاحك</li>
    <li>يوم الخميس: البورتل ينشر على <em class="en">Vercel</em></li>
    <li>يوم السبت: مدير تنفيذي يفتح البورتل، يشوف مشروع متأخّر بـ <em class="i">IPI</em> = 100 "On Track"</li>
    <li>يسأل: "شنو هذا الغلط؟" ← أنت تخسر ثقة الإدارة</li>
  </ol>

  <p><strong>مع <em class="i">tests</em>:</strong> يوم الأربعاء، <em class="en">Ahmed</em> يشغّل <code>npm test</code> قبل ما ينشر. يشوف: <span style="color:var(--red)">1 test failed</span>. يعرف إنه كسّر شي، يصلّح، الاختبار يمر مرّة ثانية. المستخدم ما شاف الغلط أبداً.</p>

  <div class="pf"><span><b>Testing 101</b></span><span>صفحة 2</span></div>
</div>

<!-- ─── PAGE 3 — متى تكتب test ─── -->
<div class="page">
  <div class="ph"><span class="t">الفصل 3</span><span class="n en">TESTING 101</span></div>
  <h2 class="sec">٣. متى تكتب <em class="i">test</em>؟</h2>
  <div class="sec-sub">مش لكل شي — بس للأشياء المهمّة</div>

  <p>هذا سؤال عملي مهم. مش كل تغيير في الكود يستحق <em class="i">test</em>. القاعدة الذهبية:</p>

  <div class="callout green">
    <h5>القاعدة</h5>
    <p><strong>لو الكسر ممكن يضر مستخدم أو يشوّه رقم مهم → اكتب <em class="i">test</em>.</strong> لو مجرد تغيير لون أو نصّ → لا داعي.</p>
  </div>

  <h3>اكتب <em class="i">test</em> في هذي الحالات:</h3>
  <table>
    <thead><tr><th>الحالة</th><th>مثال من بورتلك</th></tr></thead>
    <tbody>
      <tr>
        <td class="label">صلّحت <em class="en">bug</em></td>
        <td>الـ <em class="en">PV</em> كان يتقصّر عند 1.0 → صلّحته. اكتب اختبار يمنع رجوعه.</td>
      </tr>
      <tr>
        <td class="label">أضفت منطق تجاري جديد</td>
        <td>الـ <em class="en">Roadmap Penalty</em> ينخصم 1% باليوم. اكتب اختبار يتأكّد بعد 30 يوم = خصم 30%.</td>
      </tr>
      <tr>
        <td class="label">Edge case غريبة</td>
        <td>مشروع بدون milestones + بدون budget. الـ <em class="i">IPI</em> لازم يكون null. اكتب اختبار.</td>
      </tr>
      <tr>
        <td class="label">حماية من الغش</td>
        <td>لو <em class="en">PM</em> يخبّي بيانات، الـ <em class="i">IPI</em> ما يجوز يرتفع. اكتب اختبار يمنع الغش.</td>
      </tr>
      <tr>
        <td class="label">كود حسّاس</td>
        <td>حساب <em class="i">IPI</em>، <em class="en">Authentication</em>، <em class="en">Permissions</em>، أي شي فيه أرقام مهمّة أو أمان.</td>
      </tr>
    </tbody>
  </table>

  <h3>لا تكتب <em class="i">test</em> في هذي الحالات:</h3>
  <table>
    <thead><tr><th>الحالة</th><th>ليش لا</th></tr></thead>
    <tbody>
      <tr>
        <td class="label">تغيير لون أو font</td>
        <td>لا يوجد رقم صحيح أو غلط. تشوفه بالعين مباشرة.</td>
      </tr>
      <tr>
        <td class="label">تعديل نصّ في زر</td>
        <td>لو الزر يقول "احفظ" وغيّرته لـ "Save"، ما فيه شي "صحيح" رياضياً.</td>
      </tr>
      <tr>
        <td class="label">Layout / تنسيق</td>
        <td>الاختبار الحقيقي = تفتح البورتل وتشوف. مش لعبة أرقام.</td>
      </tr>
      <tr>
        <td class="label">شي بسيط جداً واضح</td>
        <td><code>getValue() { return value; }</code> — ما يستحق اختبار.</td>
      </tr>
      <tr>
        <td class="label">تفاعل تعتمد على متصفح</td>
        <td>Drag &amp; drop، animations — تختبرها يدوياً.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout blue">
    <h5>القاعدة العملية</h5>
    <p>لو تسأل نفسك: "هل ممكن هذا التغيير يكسّر شي بدون ما أنتبه بعد شهر؟" — لو الجواب نعم، اكتب <em class="i">test</em>. لو "لا، أشوفه فوراً"، ما تحتاج.</p>
  </div>

  <div class="pf"><span><b>Testing 101</b></span><span>صفحة 3</span></div>
</div>

<!-- ─── PAGE 4 — الأوامر ─── -->
<div class="page">
  <div class="ph"><span class="t">الفصل 4</span><span class="n en">TESTING 101</span></div>
  <h2 class="sec">٤. كيف تشغّلهم؟ الأوامر</h2>
  <div class="sec-sub">4 أوامر فقط — احفظهم في القلب</div>

  <div class="cheat">
    <div class="cheat-title">🎯 الأربع أوامر الأساسية</div>

    <div class="cmd">
      <span>cd C:\\Users\\nioh1\\Downloads\\pmo-portal-clone</span>
      <span class="what">← وديني للمشروع</span>
    </div>

    <div class="cmd">
      <span>npm test</span>
      <span class="what">← شغّل كل الاختبارات</span>
    </div>

    <div class="cmd">
      <span>npm run build</span>
      <span class="what">← تأكّد الكود ينبني (بدون اختبار)</span>
    </div>

    <div class="cmd">
      <span>npm run lint</span>
      <span class="what">← تأكّد الكود نظيف من ناحية النحو</span>
    </div>
  </div>

  <h3>الترتيب الطبيعي لأي شغل تسويه:</h3>
  <ol>
    <li>عدّل الكود (أو اكتب اختبار جديد)</li>
    <li><code>cd C:\\Users\\nioh1\\Downloads\\pmo-portal-clone</code> (لو مب هناك)</li>
    <li><code>npm test</code></li>
    <li>لو <span style="color:var(--green); font-weight:800">Tests passed</span> → تمام، احفظ التعديل</li>
    <li>لو <span style="color:var(--red); font-weight:800">Tests failed</span> → اقرأ الرسالة، صلّح، أعد الأمر</li>
  </ol>

  <h3>وش تشوف على الشاشة؟</h3>
  <p>لما تشغّل <code>npm test</code> راح يطلع كذا:</p>

  <div class="callout green">
    <h5>✓ Success (كل شي تمام)</h5>
    <p style="font-family:'JetBrains Mono',monospace; font-size:10pt;">
      Test Files  1 passed (1)<br>
      Tests  69 passed (69)<br>
      Duration  441ms
    </p>
  </div>

  <div class="callout red">
    <h5>✗ Failure (فيه شي مكسور)</h5>
    <p style="font-family:'JetBrains Mono',monospace; font-size:10pt;">
      Test Files  1 failed (1)<br>
      Tests  2 failed | 67 passed (69)<br>
      ✗ SPI is capped at 1.20 when raw EV/PV exceeds it<br>
      ✗ penalty is applied multiplicatively to SPI
    </p>
  </div>

  <p>لو شفت <span style="color:var(--red); font-weight:800">failed</span>، الرسالة تقول لك بالضبط:</p>
  <ul>
    <li><strong>اسم الاختبار الفاشل</strong> (يوصف السلوك المكسور)</li>
    <li><strong>الرقم اللي كان متوقّع</strong> vs <strong>الرقم اللي طلع</strong></li>
    <li><strong>السطر بالضبط</strong> (مثلاً <code>metrics.test.js:280</code>)</li>
  </ul>

  <div class="pf"><span><b>Testing 101</b></span><span>صفحة 4</span></div>
</div>

<!-- ─── PAGE 5 — Anatomy of a test ─── -->
<div class="page">
  <div class="ph"><span class="t">الفصل 5</span><span class="n en">TESTING 101</span></div>
  <h2 class="sec">٥. شكل الاختبار الواحد</h2>
  <div class="sec-sub">3 أجزاء فقط — دائماً بنفس البنية</div>

  <p>كل اختبار في العالم — من أي مبرمج، في أي مشروع — له نفس البنية الذهبية. حفظت هذي البنية، فهمت 95% من الـ <em class="i">testing</em>:</p>

  <div class="callout blue">
    <h5>البنية الذهبية</h5>
    <p><strong>Setup</strong> (جهّز) → <strong>Act</strong> (نفّذ) → <strong>Assert</strong> (تحقّق)</p>
  </div>

  <h3>مثال حقيقي — اختبار كتبته أنت</h3>
  <p>الاختبار اللي كتبته اليوم يقول: "لو مشروع بدأ اليوم بدون بيانات، الـ <em class="i">IPI</em> لازم يكون null."</p>

  <table>
    <thead><tr><th>الجزء</th><th>الوظيفة</th><th>مثالك</th></tr></thead>
    <tbody>
      <tr>
        <td class="label">Setup</td>
        <td>جهّز مشروع خيالي بمعطيات معيّنة</td>
        <td>startDate اليوم، progress = 0، مافيه milestones ولا docs</td>
      </tr>
      <tr>
        <td class="label">Act</td>
        <td>طبّق الـ engine على المشروع</td>
        <td>احسب IPI</td>
      </tr>
      <tr>
        <td class="label">Assert</td>
        <td>تحقّق النتيجة كما تتوقّع</td>
        <td>IPI لازم يكون null</td>
      </tr>
    </tbody>
  </table>

  <h3>القاعدة الذهبية</h3>
  <div class="callout green">
    <p style="font-size:12pt">
      <strong>Setup:</strong> ما هو الوضع؟<br>
      <strong>Act:</strong> شنو نطبّق؟<br>
      <strong>Assert:</strong> شنو المفروض يصير؟
    </p>
  </div>

  <p>لو تعرف تجاوب على الأسئلة الثلاثة، تقدر تكتب <em class="i">test</em>.</p>

  <div class="pf"><span><b>Testing 101</b></span><span>صفحة 5</span></div>
</div>

<!-- ─── PAGE 6 — الـ 69 اختبار ─── -->
<div class="page">
  <div class="ph"><span class="t">الفصل 6</span><span class="n en">TESTING 101</span></div>
  <h2 class="sec">٦. الـ 69 اختبار عندك — إيش يحرسون؟</h2>
  <div class="sec-sub">كل رقم أخضر = سلوك محمي رياضياً</div>

  <p>الـ 69 اختبار مش عشوائية — كل واحد فيهم يحمي سلوك محدّد في الـ <em class="en">IPI engine</em>. تصنيفهم:</p>

  <table>
    <thead><tr><th>المجموعة</th><th>عدد</th><th>يحرس ماذا؟</th></tr></thead>
    <tbody>
      <tr>
        <td class="label"><span class="en">parseGateNumber</span></td>
        <td>4</td>
        <td>قراءة أرقام الـ Gates من نصوص مختلفة</td>
      </tr>
      <tr>
        <td class="label">MCI — Documents</td>
        <td>7</td>
        <td>حساب امتثال الوثائق حسب الـ Gate</td>
      </tr>
      <tr>
        <td class="label">Anticipated MCI</td>
        <td>4</td>
        <td>توقّع الـ MCI عند الـ Gate التالي</td>
      </tr>
      <tr>
        <td class="label">Project Status</td>
        <td>5</td>
        <td>اشتقاق الحالة (Delayed، Completed، Not Started)</td>
      </tr>
      <tr>
        <td class="label">Component Caps</td>
        <td>3</td>
        <td>حدود SPI و CPI عند 1.20</td>
      </tr>
      <tr>
        <td class="label">Roadmap Anchor</td>
        <td>4</td>
        <td>SPI يقاس ضد Roadmap، Padding لا ينفع</td>
      </tr>
      <tr>
        <td class="label">Null Handling</td>
        <td>3</td>
        <td>إعادة معايرة الأوزان مع البيانات الناقصة</td>
      </tr>
      <tr>
        <td class="label">Dept &amp; Portfolio IPI</td>
        <td>4</td>
        <td>تجميع مرجّح بالميزانية × الأولوية</td>
      </tr>
      <tr>
        <td class="label">Time-Weighted (90-day)</td>
        <td>6</td>
        <td>متوسط 90 يوم، معالجة الـ snapshots</td>
      </tr>
      <tr>
        <td class="label">Data Reliability</td>
        <td>4</td>
        <td>رفض IPI للتواريخ المستحيلة و baseline forming</td>
      </tr>
      <tr>
        <td class="label"><strong>Your first test</strong></td>
        <td>1</td>
        <td>Baseline forming = null IPI (اختبارك أنت!)</td>
      </tr>
      <tr>
        <td>+ أخرى</td>
        <td>24</td>
        <td>مجموعات صغيرة مختلفة</td>
      </tr>
    </tbody>
  </table>

  <div class="callout blue">
    <h5>فكرة تنظيمية</h5>
    <p>لما تكتب اختبار جديد، حاول تحطّه في <em class="en">describe()</em> بلوك موجود إذا كان يشابه سلوك في نفس المجموعة. لو موضوع جديد كلياً، أنشئ <em class="en">describe()</em> جديد.</p>
  </div>

  <div class="pf"><span><b>Testing 101</b></span><span>صفحة 6</span></div>
</div>

<!-- ─── PAGE 7 — Cheat sheet ─── -->
<div class="page">
  <div class="ph"><span class="t">الفصل 7</span><span class="n en">TESTING 101</span></div>
  <h2 class="sec">٧. ملخّص عملي</h2>
  <div class="sec-sub">صفحة واحدة تحتفظ فيها للمرجعية</div>

  <h3>🧠 الفكرة</h3>
  <p><em class="i">Test</em> = مفتّش جودة آلي. يتحقّق إن جزء من الكود يشتغل صح بدون ما تفتح البورتل. لو أحد كسّر شي، يخبرك فوراً قبل ما يوصل الإنتاج.</p>

  <h3>🚦 متى تكتب واحد</h3>
  <ul>
    <li>✅ صلّحت <em class="en">bug</em> — اكتب اختبار يمنع رجوعه</li>
    <li>✅ منطق تجاري جديد (حساب، منطق فيه أرقام)</li>
    <li>✅ Edge case غريبة</li>
    <li>❌ تغيير لون / نصّ / layout</li>
    <li>❌ شي بسيط جداً واضح</li>
  </ul>

  <h3>🎯 الأوامر</h3>
  <div class="cheat">
    <div class="cmd">
      <span>cd C:\\Users\\nioh1\\Downloads\\pmo-portal-clone</span>
      <span class="what">وديني للمشروع</span>
    </div>
    <div class="cmd">
      <span>npm test</span>
      <span class="what">شغّل كل الاختبارات</span>
    </div>
  </div>

  <h3>📖 قراءة النتيجة</h3>
  <ul>
    <li><span style="color:var(--green); font-weight:800">Tests X passed (X)</span> = كل شي تمام، انشر بأمان</li>
    <li><span style="color:var(--red); font-weight:800">Tests Y failed</span> = فيه شي مكسور، اقرأ الرسالة، صلّح</li>
  </ul>

  <h3>🧱 بنية أي اختبار</h3>
  <div class="callout">
    <p><strong>Setup:</strong> ما هو الوضع؟ (جهّز مشروع خيالي بـ <code>mk({...})</code>)</p>
    <p><strong>Act:</strong> شنو نطبّق؟ (استدعِ <em class="en">function</em> مثلاً <code>ipi(p)</code>)</p>
    <p><strong>Assert:</strong> شنو المفروض يصير؟ (تحقّق بـ <code>expect(...)</code>)</p>
  </div>

  <h3>⚠ 5 أشياء لا تنساها</h3>
  <ol>
    <li>الـ <em class="i">tests</em> ما تكتب الكود — تحرس الكود</li>
    <li>كل <em class="en">bug fix</em> = فرصة لكتابة اختبار حماية</li>
    <li>الأخضر يعني "استمر"، الأحمر يعني "توقّف واقرأ"</li>
    <li>لو مش متأكّد إذا تحتاج اختبار: أفضل تكتبه</li>
    <li>الـ CI (اللي أضافه Ahmed) يشغّل الاختبارات تلقائياً على كل <em class="en">push</em>. فأنت محمي حتى لو نسيت.</li>
  </ol>

  <div class="why">
    <h5>الخلاصة النهائية</h5>
    <p>الـ 69 اختبار عندك = 69 وعد رياضي إن الـ <em class="i">IPI engine</em> يشتغل صح. كل مرّة تشوف <span style="color:var(--sea-bright); font-weight:800">Tests 69 passed</span>، ذكّر نفسك: هذي 69 مشكلة ممكن تصير — ومحمي منها.</p>
  </div>

  <div class="pf"><span><b>Testing 101</b> · نهاية الوثيقة</span><span>صفحة 7</span></div>
</div>

</body>
</html>`;

const outDir = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outHtml = path.join(outDir, "Testing-101-Personal.html");
const outPdf  = path.join(outDir, "Testing-101-Personal.pdf");
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
