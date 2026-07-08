// Build the Arabic developer-meeting cheat sheet.
// Output: Desktop/PMO-Portal-Deliverables/Meeting-Cheat-Sheet-AR.{html,pdf}
//
// Designed for use from the company laptop where ONLY a browser is available
// (no VS Code, no terminal, no local dev). Every Q&A teaches the terminology
// before giving the ready answer.
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>ورقة ميتنق المطوّرين — PMO Portal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&display=swap');

  :root {
    --canopy:  #003932; --canopy-2: #005c4b; --canopy-3: #007a62;
    --sea:     #00FFB3; --sea-2:    #00b894;
    --orange:  #FF5000; --orange-lt:#fff5ee;
    --maroon:  #490300; --maroon-lt:#fef2f0;
    --moss:    #A1B9AB; --moss-dark:#5a7a6e;
    --lichen:  #C9D5C9; --lichen-lt:#ecf2ed;
    --ink:     #0d1f1c; --muted:    #4b6c67; --border: #d1e8e4;
    --bg:      #f5faf9;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo', sans-serif;
    color: var(--ink);
    background: #1a1a1a;
    line-height: 1.55;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 210mm; min-height: 297mm;
    background: white;
    padding: 11mm 13mm;
    margin: 8mm auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.35);
    display: flex; flex-direction: column;
  }
  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    @page { size: A4; margin: 0; }
  }

  /* ── COVER ── */
  .cover {
    background:
      radial-gradient(circle at 90% 50%, rgba(0,255,179,0.12) 0%, transparent 50%),
      linear-gradient(135deg, #001f1a 0%, var(--canopy) 60%, var(--canopy-3) 100%);
    color: white;
    padding: 14px 20px;
    border-radius: 12px;
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 14px;
    border-bottom: 3px solid var(--sea);
  }
  .cover .logo { width: 46px; height: 46px; border-radius: 10px; flex-shrink: 0; }
  .cover .ttl { flex: 1; }
  .cover .ttl .label { color: var(--sea); font-size: 9pt; font-weight: 700; letter-spacing: 1px; margin-bottom: 3px; }
  .cover .ttl h1 { font-size: 16pt; font-weight: 900; line-height: 1.1; color: white; letter-spacing: -0.3px; }
  .cover .ttl .sub { color: rgba(255,255,255,0.65); font-size: 8.5pt; margin-top: 3px; font-weight: 500; }
  .cover .meta { text-align: left; font-size: 8pt; color: rgba(255,255,255,0.55); font-weight: 600; }
  .cover .meta .v { color: var(--sea); font-weight: 800; font-size: 9.5pt; }

  /* ── SECTION ── */
  .sec { margin-bottom: 11px; }
  .sec-h {
    display: flex; align-items: center; gap: 9px;
    margin-bottom: 7px;
  }
  .sec-h .ix {
    background: var(--canopy); color: var(--sea);
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt; font-weight: 800;
    padding: 3px 8px; border-radius: 5px;
  }
  .sec-h.priority .ix { background: var(--maroon); color: white; }
  .sec-h.qa .ix       { background: var(--orange); color: white; }
  .sec-h.deep .ix     { background: var(--moss-dark); color: white; }
  .sec-h h2 { font-size: 11.5pt; font-weight: 800; color: var(--canopy); }
  .sec-h .meta { margin-right: auto; font-size: 8pt; color: var(--muted); font-weight: 600; }

  /* ── REALITY BOX ── */
  .reality {
    background: var(--maroon-lt);
    border: 1.5px solid var(--maroon);
    border-radius: 10px;
    padding: 11px 14px;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .reality h3 {
    font-size: 9pt; font-weight: 800;
    margin-bottom: 5px;
    letter-spacing: 0.3px;
  }
  .reality .yes h3 { color: var(--canopy-2); }
  .reality .no h3 { color: var(--maroon); }
  .reality ul { list-style: none; }
  .reality li {
    font-size: 9pt; line-height: 1.6;
    padding-right: 14px; position: relative;
    font-weight: 500;
  }
  .reality .yes li::before {
    content: '✓'; color: var(--canopy-2); font-weight: 900;
    position: absolute; right: 0;
  }
  .reality .no li::before {
    content: '✗'; color: var(--maroon); font-weight: 900;
    position: absolute; right: 0;
  }

  /* ── OPEN URLs ── */
  .urls {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .url-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-right: 3px solid var(--sea-2);
    border-radius: 8px;
    padding: 9px 12px;
  }
  .url-card .l {
    font-size: 8pt; font-weight: 700;
    color: var(--muted); letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  .url-card .v {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt; color: var(--canopy);
    font-weight: 700; direction: ltr; text-align: left;
    word-break: break-all;
  }
  .url-card .d {
    font-size: 8.5pt; color: var(--muted);
    margin-top: 3px; font-weight: 500;
  }

  /* ── PLAN TABLE ── */
  .plan {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .plan-row {
    display: grid;
    grid-template-columns: 50px 1.2fr 2fr;
    align-items: center;
    padding: 7px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 8.5pt;
  }
  .plan-row:last-child { border-bottom: 0; }
  .plan-row .time {
    color: var(--sea-2); font-weight: 800;
    font-family: 'JetBrains Mono', monospace; font-size: 9pt;
  }
  .plan-row .title { font-weight: 700; color: var(--canopy); font-size: 9.5pt; }
  .plan-row .desc { color: var(--muted); font-size: 8.5pt; line-height: 1.45; }

  /* ── Q&A CARDS (TEACHING STYLE) ── */
  .qa { display: flex; flex-direction: column; gap: 10px; }

  .qa-card {
    background: white;
    border: 1px solid var(--border);
    border-right: 4px solid var(--orange);
    border-radius: 0 12px 12px 0;
    padding: 12px 15px;
  }
  .qa-card .q-label {
    color: var(--orange); font-size: 8pt; font-weight: 800;
    letter-spacing: 0.3px; margin-bottom: 3px;
  }
  .qa-card .q-text {
    color: var(--ink); font-size: 10.5pt; font-weight: 700;
    margin-bottom: 9px;
  }

  .qa-card .block {
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--border);
  }
  .qa-card .block:last-child {
    margin-bottom: 0; padding-bottom: 0; border-bottom: 0;
  }

  .qa-card .b-label {
    display: inline-block;
    font-size: 7.5pt; font-weight: 800;
    padding: 2px 7px; border-radius: 4px;
    margin-bottom: 4px;
    letter-spacing: 0.3px;
  }
  .qa-card .b-glos .b-label   { background: #ddebff; color: #1e40af; }
  .qa-card .b-essence .b-label { background: #fef3c7; color: #92400e; }
  .qa-card .b-answer .b-label  { background: #dcfce7; color: #15803d; }
  .qa-card .b-ask .b-label     { background: var(--maroon-lt); color: var(--maroon); }

  .qa-card .b-body {
    font-size: 9pt; line-height: 1.6;
    color: var(--ink);
  }
  .qa-card .b-body strong { color: var(--canopy); font-weight: 700; }
  .qa-card .b-body em { color: var(--orange); font-style: normal; font-weight: 700; }
  .qa-card .b-body code {
    background: var(--lichen-lt); color: var(--canopy);
    padding: 1px 5px; border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt; direction: ltr; display: inline-block;
  }
  .qa-card .b-glos .b-body { font-size: 8.5pt; }
  .qa-card .b-glos .term {
    display: block; padding: 2px 0;
  }
  .qa-card .b-glos .term strong {
    color: #1e40af; font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
  }

  .qa-card .b-answer {
    background: #f0fdf4;
    border-radius: 8px;
    padding: 8px 11px;
    border-right: 3px solid #15803d;
    margin-right: -3px;
  }
  .qa-card .b-answer .b-body { color: var(--canopy); font-weight: 500; }

  .qa-card .b-ask {
    background: var(--maroon-lt);
    border-radius: 8px;
    padding: 8px 11px;
    border-right: 3px solid var(--maroon);
    margin-right: -3px;
  }
  .qa-card .b-ask .b-body { color: var(--maroon); font-weight: 600; font-style: italic; }

  /* ── DISCLOSURES (HONEST WEAKNESSES) ── */
  .disc-intro {
    background: #fff8eb;
    border-right: 3px solid #d97706;
    border-radius: 0 8px 8px 0;
    padding: 8px 12px;
    font-size: 8.5pt; line-height: 1.55;
    color: #78350f;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .disc-intro strong { color: #92400e; font-weight: 800; }
  .disclosures {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 7px;
  }
  .disc-card {
    background: #fff8eb;
    border: 1px solid #fcd34d;
    border-right: 3px solid #d97706;
    border-radius: 0 8px 8px 0;
    padding: 8px 11px;
  }
  .disc-card .title {
    font-size: 9pt; font-weight: 800; color: #92400e;
    margin-bottom: 4px;
  }
  .disc-card .what {
    font-size: 8.5pt; color: var(--ink); line-height: 1.55;
    font-weight: 500; margin-bottom: 4px;
  }
  .disc-card .what strong {
    color: #92400e; font-weight: 800;
  }
  .disc-card .what em {
    color: #d97706; font-style: normal; font-weight: 700;
  }
  .disc-card .why,
  .disc-card .fix {
    font-size: 8pt; line-height: 1.4;
    display: block; margin-top: 2px;
  }
  .disc-card .why { color: #78350f; font-weight: 500; }
  .disc-card .why::before { content: '◇ '; color: #d97706; font-weight: 700; }
  .disc-card .fix { color: var(--canopy-2); font-weight: 700; }
  .disc-card .fix::before { content: '→ '; color: var(--canopy-2); font-weight: 700; }

  /* ── GLOSSARY ── */
  .glossary {
    background: var(--lichen-lt);
    border-radius: 10px;
    padding: 11px 14px;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 7px 18px;
  }
  .gl-item {
    font-size: 8.5pt;
    line-height: 1.5;
    padding: 4px 0;
    border-bottom: 1px dotted var(--border);
  }
  .gl-item:last-child, .gl-item:nth-last-child(2) { border-bottom: 0; }
  .gl-item strong {
    color: var(--canopy);
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt; font-weight: 800;
    margin-left: 4px;
  }
  .gl-item .ar { color: var(--ink); font-weight: 600; }
  .gl-item .desc { color: var(--muted); display: block; margin-top: 1px; font-weight: 500; font-size: 8pt; }

  /* ── FALLBACK ── */
  .fallback {
    background: var(--maroon-lt);
    border-right: 4px solid var(--maroon);
    border-radius: 0 10px 10px 0;
    padding: 10px 13px;
  }
  .fallback .h {
    color: var(--maroon); font-size: 9pt; font-weight: 800;
    margin-bottom: 4px;
  }
  .fallback p {
    font-size: 9pt; color: var(--ink); line-height: 1.6;
    font-weight: 500;
  }
  .fallback p strong { color: var(--canopy); font-weight: 700; }
  .fallback code {
    background: white; color: var(--canopy);
    padding: 1px 5px; border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt; direction: ltr; display: inline-block;
  }

  /* ── FOOTER ── */
  .foot {
    margin-top: auto;
    padding-top: 7px;
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between;
    font-size: 7.5pt; color: var(--muted);
    font-weight: 600;
  }
</style>
</head>
<body>

<!-- ════════════════════════ PAGE 1 ════════════════════════ -->
<div class="page">

  <div class="cover">
    <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
    <div class="ttl">
      <div class="label">ميتنق المطوّرين · ورقة شرح + ردود</div>
      <h1>كل سؤال يبدأ بـ "إيش يعني هالكلام"</h1>
      <div class="sub">عشان تفهم المصطلحات وترد بثقة، مش بس تقرأ جواب جاهز</div>
    </div>
    <div class="meta">
      <div class="v">PMO Portal</div>
      <div>تسليم فني · Tree</div>
    </div>
  </div>

  <!-- ══════════ SEC 1 — REALITY CHECK ══════════ -->
  <div class="sec">
    <div class="sec-h priority">
      <span class="ix">1</span>
      <h2>الواقع · من لابتوب الشركة</h2>
      <span class="meta">تعرف إيش تقدر تسوّي وإيش لا</span>
    </div>
    <div class="reality">
      <div class="yes">
        <h3>متاح لك:</h3>
        <ul>
          <li>افتح البورتل live في المتصفّح</li>
          <li>افتح الكود على GitHub في المتصفّح</li>
          <li>تتنقّل بين الملفات وتشوف التعليقات</li>
          <li>تشوف commit history</li>
          <li>تفتح هالـ PDF على شاشة جنبية</li>
        </ul>
      </div>
      <div class="no">
        <h3>غير متاح:</h3>
        <ul>
          <li>VS Code محلي</li>
          <li>أوامر terminal (npm test, npm run dev)</li>
          <li>localhost</li>
          <li>الـ source code محلياً</li>
          <li>لا تقول "خلّوني أشغّل عندي"</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- ══════════ SEC 2 — URLs to open ══════════ -->
  <div class="sec">
    <div class="sec-h">
      <span class="ix">2</span>
      <h2>افتح هذولا في تابين منفصلين قبل الميتنق</h2>
      <span class="meta">جاهزين قبل ما يدخلون</span>
    </div>
    <div class="urls">
      <div class="url-card">
        <div class="l">البورتل LIVE</div>
        <div class="v">https://pmo-portal-seven.vercel.app</div>
        <div class="d">اللي يشتغل فعلياً — للديمو والتنقّل بين الصفحات</div>
      </div>
      <div class="url-card">
        <div class="l">الكود على GITHUB</div>
        <div class="v">github.com/Moh-Salman11109/pmo-portal</div>
        <div class="d">المصدر — لتورّيهم الملفات والـ commit history</div>
      </div>
    </div>
  </div>

  <!-- ══════════ SEC 3 — Meeting plan ══════════ -->
  <div class="sec">
    <div class="sec-h">
      <span class="ix">3</span>
      <h2>خطة الميتنق · 30 دقيقة</h2>
      <span class="meta">رتّبها فيك من البداية</span>
    </div>
    <div class="plan">
      <div class="plan-row">
        <div class="time">8 د</div>
        <div class="title">ديمو live على المتصفّح</div>
        <div class="desc">روح Home → Department → Project. ورّيهم الـ Hero الأخضر، الـ tiers الخمسة، اضغط 📄 Print Report يطلع PDF فوراً.</div>
      </div>
      <div class="plan-row">
        <div class="time">4 د</div>
        <div class="title">اعترافات تقنية · أنت اللي تذكرها</div>
        <div class="desc">قبل ما يسألون، اذكر القيود المعروفة (القسم رقم 4 في هالورقة). تكسب احترامهم لما تعرف نقاط الضعف.</div>
      </div>
      <div class="plan-row">
        <div class="time">5 د</div>
        <div class="title">المعمارية بالكلام</div>
        <div class="desc">React + Vite للواجهة · SharePoint للبيانات · Microsoft Entra ID للـ auth · Power Automate للموافقات · Vercel للنشر حالياً (راح يتغيّر).</div>
      </div>
      <div class="plan-row">
        <div class="time">7 د</div>
        <div class="title">جولة في GitHub</div>
        <div class="desc">افتح GitHub وروح <code style="font-family:'JetBrains Mono',monospace;">src/App.jsx</code> ورّيهم الـ roadmap فوق + section dividers. ثم <code style="font-family:'JetBrains Mono',monospace;">HomeView.jsx</code> و <code style="font-family:'JetBrains Mono',monospace;">metrics.js</code>.</div>
      </div>
      <div class="plan-row">
        <div class="time">10 د</div>
        <div class="title">نقاش متطلّباتهم</div>
        <div class="desc">يدخلون في الأسئلة الكبيرة: IAM، GitHub الشركة، الاستضافة على بيئتهم. الردود في الصفحة الجاية.</div>
      </div>
    </div>
  </div>

  <!-- ══════════ SEC 4 — DISCLOSURES (NEW) ══════════ -->
  <div class="sec">
    <div class="sec-h priority">
      <span class="ix">4</span>
      <h2>اعترافات تقنية · أنت اللي تذكرها قبل ما يسألون</h2>
      <span class="meta">تكسب احترامهم لما تعرف نقاط الضعف</span>
    </div>
    <div class="disc-intro">
      📣 افتحها لما تخلص الديمو: <strong>"خلّوني أذكر لكم القيود اللي أنا واعي لها من اللحظة الأولى — هذا MVP بـ scope محدّد، اللي تحت موجود بنيّة الـ V2."</strong>
    </div>
    <div class="disclosures">
      <div class="disc-card">
        <div class="title">الإخفاء مش قُفل · UI hide</div>
        <div class="what">الواجهة تخفي الأزرار حسب دور المستخدم. لكن لو شخص <em>تقني</em> عرف يكلّم SharePoint مباشرة (يتجاوز البورتل)، يقدر يطلع على البيانات اللي صلاحيته يسمح بها. <strong>الإخفاء بصري، الحماية الفعلية تجي من Microsoft 365 نفسه.</strong></div>
        <span class="why">ليش: اعتمدنا على Microsoft 365 permissions كطبقة دفاع رئيسية في الـ MVP</span>
        <span class="fix">الحل: نضيف طبقة وسيطة (middleware) تتحقّق من كل طلب قبل ما يوصل البيانات</span>
      </div>

      <div class="disc-card">
        <div class="title">مفتاح الدخول في المتصفّح · token</div>
        <div class="what">بعد ما تسجّل دخولك، Microsoft يعطيك "مفتاح إلكتروني" يخزّن في ذاكرة المتصفّح. <strong>لو الموقع تعرّض لاختراق نوع XSS، المفتاح يُسرق ويدخل بيك حد ثاني.</strong> هذا الـ default عند مايكروسوفت، لكن في طريقة أأمن لو يبون.</div>
        <span class="why">ليش: الـ default الفطري من Microsoft Authentication Library</span>
        <span class="fix">الحل: نخزّن المفتاح في "ملف تعريف ارتباط" مشفّر (HttpOnly cookie) عبر backend proxy</span>
      </div>

      <div class="disc-card">
        <div class="title">الاختبارات الآلية محدودة · tests</div>
        <div class="what">عندي <strong>46 اختبار آلي</strong> على الحسابات الرياضية للـ IPI (الجزء الأهم). <em>لكن</em> ما فيه اختبارات تحاكي مستخدم حقيقي يدخل الموقع ويستخدمه من البداية للنهاية.</div>
        <span class="why">ليش: ركّزنا على صحة الـ math قبل تجربة الاستخدام في الـ MVP</span>
        <span class="fix">الحل: نضيف Playwright أو Cypress — أدوات تحاكي مستخدم حقيقي تلقائياً</span>
      </div>

      <div class="disc-card">
        <div class="title">حجم الملف اللي يحمّله المتصفّح · 1.1MB</div>
        <div class="what">لما المستخدم يفتح البورتل أوّل مرة، المتصفّح يحمّل <strong>1.1MB</strong> من ملفات الكود. <em>المثالي 500KB</em>. النتيجة: تحميل أوّل مرة أبطأ، خصوصاً على إنترنت ضعيف.</div>
        <span class="why">ليش: كل الواجهات في ملف واحد عشان سرعة التطوير</span>
        <span class="fix">الحل: نقطّع الملف لقطع صغيرة، كل واجهة تحمّل بس لما تفتحها (lazy loading)</span>
      </div>

      <div class="disc-card">
        <div class="title">سقف SharePoint · مستقبلي مش حالي</div>
        <div class="what">SharePoint <strong>شغّال ممتاز للحجم الحالي</strong> (عندنا ~30 مشروع، الحد 5000 لكل جدول). لكن نعرف الحدود لما يكبر النظام: البيانات المعقّدة نحشرها كنص داخل خانة، وما فيه روابط ذكية بين الجداول.
        <em>المهم:</em> هذا اعتبار للسنوات الجاية، مش مشكلة الآن.</div>
        <span class="why">ليش: SharePoint موجود في بيئة الشركة، أسرع وأرخص للبداية</span>
        <span class="fix">الحل المستقبلي: لو وصلنا 1000+ مشروع، ننقل لـ SQL Server أو Cosmos DB</span>
      </div>

      <div class="disc-card">
        <div class="title">ما فيه سجل متابعة · audit log</div>
        <div class="what">لو حد عدّل بيانات، <strong>ما نقدر نتبعه من داخل البورتل</strong> — نعتمد على سجل Microsoft 365 الفطري. ولو حصل خطأ تقني عند مستخدم، <em>ما نعرف</em> إلا إذا شكا.</div>
        <span class="why">ليش: M365 audit log كان كافي للـ MVP</span>
        <span class="fix">الحل: نضيف Application Insights — أداة مراقبة من مايكروسوفت تسجّل كل شي وترسل تنبيهات للأخطاء</span>
      </div>
    </div>
  </div>

  <!-- ══════════ SEC 5 — Glossary ══════════ -->
  <div class="sec">
    <div class="sec-h deep">
      <span class="ix">5</span>
      <h2>قاموس سريع · مصطلحات يحتمل ينطقونها</h2>
      <span class="meta">اقرأها مرّة قبل الميتنق · بترسخ</span>
    </div>
    <div class="glossary">
      <div class="gl-item">
        <strong>SSO</strong><span class="ar">Single Sign-On</span>
        <span class="desc">تسجيل دخول مرة وحدة يفتح لك كل الأنظمة</span>
      </div>
      <div class="gl-item">
        <strong>MSAL</strong><span class="ar">Microsoft Authentication Library</span>
        <span class="desc">مكتبة جاهزة تشغّل SSO مع Azure AD</span>
      </div>
      <div class="gl-item">
        <strong>OIDC</strong><span class="ar">OpenID Connect</span>
        <span class="desc">البروتوكول المعياري للـ SSO الحديث</span>
      </div>
      <div class="gl-item">
        <strong>SAML</strong><span class="ar">Security Assertion Markup Language</span>
        <span class="desc">بروتوكول SSO أقدم — لا يزال شائع في الشركات</span>
      </div>
      <div class="gl-item">
        <strong>IAM</strong><span class="ar">Identity &amp; Access Management</span>
        <span class="desc">نظام إدارة هويات (Okta · Auth0 · Keycloak · داخلي)</span>
      </div>
      <div class="gl-item">
        <strong>OAuth Token</strong><span class="ar">رمز الوصول</span>
        <span class="desc">سلسلة أحرف يقول للسيرفر "هذا اليوزر مفوّض"</span>
      </div>
      <div class="gl-item">
        <strong>REST API</strong><span class="ar">واجهة برمجية</span>
        <span class="desc">طريقة تطبيقات تتكلم عبر HTTP requests</span>
      </div>
      <div class="gl-item">
        <strong>SPA</strong><span class="ar">Single Page Application</span>
        <span class="desc">تطبيق صفحة واحدة (React/Vue) — البورتل من هذا النوع</span>
      </div>
      <div class="gl-item">
        <strong>Static Files</strong><span class="ar">ملفات ثابتة</span>
        <span class="desc">HTML/CSS/JS بعد الـ build · أي web server يخدمها</span>
      </div>
      <div class="gl-item">
        <strong>CI/CD</strong><span class="ar">نشر تلقائي</span>
        <span class="desc">كل push للكود → اختبار → بناء → نشر آلياً</span>
      </div>
      <div class="gl-item">
        <strong>DNS / CNAME</strong><span class="ar">توجيه دومين</span>
        <span class="desc">تربط اسم (pmo.tree.com.sa) بسيرفر معيّن</span>
      </div>
      <div class="gl-item">
        <strong>IIS</strong><span class="ar">Internet Information Services</span>
        <span class="desc">web server من مايكروسوفت يجي مع Windows Server</span>
      </div>
    </div>
  </div>

  <div class="foot">
    <span>ورقة ميتنق المطوّرين — PMO Portal · Tree Digital Insurance</span>
    <span>الصفحة 1 من 3 — اقلب للأسئلة الكبيرة</span>
  </div>
</div>

<!-- ════════════════════════ PAGE 2 ════════════════════════ -->
<div class="page">

  <div class="sec">
    <div class="sec-h qa">
      <span class="ix">6</span>
      <h2>الأسئلة الكبيرة · كل سؤال فيه شرح + ردّك + سؤالك لهم</h2>
      <span class="meta">الأهم في الورقة كلها</span>
    </div>

    <div class="qa">

      <!-- Q1: IAM -->
      <div class="qa-card">
        <div class="q-label">السؤال المتوقّع</div>
        <div class="q-text">"ما نبغى Microsoft Authentication، نبغى نستخدم الـ IAM حق الشركة"</div>

        <div class="block b-glos">
          <span class="b-label">شرح المصطلحات</span>
          <div class="b-body">
            <span class="term"><strong>MSAL</strong> = مكتبة من مايكروسوفت تتعامل مع تسجيل الدخول عبر Azure AD. هي اللي شغّالة الحين في البورتل.</span>
            <span class="term"><strong>Azure AD / Entra ID</strong> = خدمة الهويات من مايكروسوفت — تخزّن المستخدمين والصلاحيات.</span>
            <span class="term"><strong>IAM</strong> = نظام إدارة هويات بشكل عام. أمثلة: Okta, Auth0, Keycloak, أو IAM داخلي طوّرته الشركة بنفسها.</span>
            <span class="term"><strong>OIDC</strong> = البروتوكول المعياري اللي يحدث وراء الكواليس وقت أي SSO حديث.</span>
          </div>
        </div>

        <div class="block b-essence">
          <span class="b-label">الفكرة الجوهرية</span>
          <div class="b-body">
            كل أنظمة الـ IAM الحديثة <strong>تتكلم نفس اللغة (OIDC)</strong>. فاستبدال MSAL بـ IAM ثاني تقني بسيط — كل التعديل في <code>src/services/auth.js</code> فقط، الباقي ما يلمس.
          </div>
        </div>

        <div class="block b-answer">
          <span class="b-label">ردّك المختصر</span>
          <div class="b-body">
            "موافق. الـ auth في <strong>ملف واحد فقط</strong> — <code>src/services/auth.js</code>. أعطوني <em>الـ IAM endpoint والـ Client ID والـ Redirect URIs والـ scopes</em>، أستبدله. الباقي ما يحتاج تعديل."
          </div>
        </div>

        <div class="block b-ask">
          <span class="b-label">سؤالك لهم</span>
          <div class="b-body">
            "إيش الـ IAM المستخدم؟ Okta? Keycloak? Auth0? وعندكم <em>OIDC discovery URL</em> جاهز نربط عليه؟"
          </div>
        </div>
      </div>

      <!-- Q2: GitHub migration -->
      <div class="qa-card">
        <div class="q-label">السؤال المتوقّع</div>
        <div class="q-text">"نبغى ننقل الكود على GitHub حق الشركة"</div>

        <div class="block b-glos">
          <span class="b-label">شرح المصطلحات</span>
          <div class="b-body">
            <span class="term"><strong>Repository (repo)</strong> = مستودع الكود — حالياً عند حسابي الشخصي <code>Moh-Salman11109</code>.</span>
            <span class="term"><strong>Organization (org)</strong> = حساب جماعي على GitHub للشركات. الشركة لازم يكون عندها org.</span>
            <span class="term"><strong>Transfer</strong> = نقل المُستودع كاملاً مع الـ history والـ issues لحساب آخر — وراء كبسة زر.</span>
            <span class="term"><strong>Fork</strong> = نسخة من الـ repo تحت ملكية ثانية — ما تنقل الملكية.</span>
            <span class="term"><strong>Commit history</strong> = سجل التعديلات. ينقل تلقائياً مع Transfer.</span>
          </div>
        </div>

        <div class="block b-essence">
          <span class="b-label">الفكرة الجوهرية</span>
          <div class="b-body">
            <strong>Transfer</strong> هو الخيار الصحيح — يحافظ على كل شي. لكن يحتاج اسم الـ org عندهم وصلاحية أنا أكون admin مؤقّت.
          </div>
        </div>

        <div class="block b-answer">
          <span class="b-label">ردّك المختصر</span>
          <div class="b-body">
            "نعم. 3 خيارات:
            <strong>(1) Transfer</strong> مباشر للـ org حقكم — يحافظ على الـ history وأنا أبقى contributor.
            <strong>(2) Fork</strong> للـ org — لو تبون نسختين.
            <strong>(3) Push كـ repo جديد</strong> — لو ما تبون history.
            أنصح بـ (1)."
          </div>
        </div>

        <div class="block b-ask">
          <span class="b-label">سؤالك لهم</span>
          <div class="b-body">
            "إيش اسم الـ <em>organization</em> حقكم على GitHub؟ وعندكم team جاهز يستلم الـ repo بعد النقل؟"
          </div>
        </div>
      </div>

      <!-- Q3: Hosting on company environment -->
      <div class="qa-card">
        <div class="q-label">السؤال المتوقّع — الأهم</div>
        <div class="q-text">"نبغى نستضيفه على بيئتنا، مب على Vercel"</div>

        <div class="block b-glos">
          <span class="b-label">شرح المصطلحات</span>
          <div class="b-body">
            <span class="term"><strong>Vercel</strong> = منصة استضافة خارجية (شركة أجنبية). البورتل حالياً عليها — وهذا اللي يبون يغيّرونه.</span>
            <span class="term"><strong>Build</strong> = العملية اللي تحوّل كود React (ملفات .jsx) إلى <em>static files</em>.</span>
            <span class="term"><strong>Static files</strong> = HTML + CSS + JS عاديين — <strong>أي web server في الدنيا يقدر يخدمهم</strong>.</span>
            <span class="term"><strong>Azure App Service</strong> = خدمة استضافة من مايكروسوفت داخل Azure. الأنسب لأن الشركة على Microsoft stack أصلاً.</span>
            <span class="term"><strong>IIS</strong> = web server من مايكروسوفت يجي مع Windows Server — لو عندهم سيرفر on-premise.</span>
            <span class="term"><strong>SPA Fallback</strong> = إعداد سطر واحد: "أي request ارجع index.html" — عشان الـ routing داخل React يشتغل.</span>
          </div>
        </div>

        <div class="block b-essence">
          <span class="b-label">الفكرة الجوهرية</span>
          <div class="b-body">
            بعد الـ build، البورتل ما يصير "تطبيق React" — يصير <strong>3 مجلدات HTML/CSS/JS فقط</strong>. أي web server يخدمها: Azure, IIS, Apache, Nginx. النقل من Vercel <em>سهل تقنياً</em>.
          </div>
        </div>

        <div class="block b-answer">
          <span class="b-label">ردّك المختصر</span>
          <div class="b-body">
            "نعم نقدر ننقله بسهولة. الـ build يطلع مجلد <code>dist/</code> فيه HTML/CSS/JS فقط. أي بيئة تشتغل:
            <strong>Azure App Service</strong> (الأنسب لأنكم على Microsoft) ·
            <strong>Azure Static Web Apps</strong> ·
            <strong>IIS على Windows Server</strong> ·
            <strong>Apache/Nginx على Linux</strong>.
            الإعداد الوحيد المطلوب: <em>SPA fallback</em> — كل route يرجّع <code>index.html</code>."
          </div>
        </div>

        <div class="block b-ask">
          <span class="b-label">سؤالك لهم</span>
          <div class="b-body">
            "إيش الـ <em>infrastructure</em> عندكم؟ Azure؟ On-premise Windows Server؟ وإيش الـ <em>deployment workflow</em> المعتمد — يدوي أو CI/CD؟"
          </div>
        </div>
      </div>

    </div>
  </div>

  <div class="foot">
    <span>ورقة ميتنق المطوّرين — PMO Portal · Tree Digital Insurance</span>
    <span>الصفحة 2 من 3 — اقلب لباقي الأسئلة</span>
  </div>
</div>

<!-- ════════════════════════ PAGE 3 ════════════════════════ -->
<div class="page">

  <div class="sec">
    <div class="sec-h qa">
      <span class="ix">6</span>
      <h2>تكملة الأسئلة الكبيرة</h2>
      <span class="meta">باقي 3 أسئلة محتمل تنطرح</span>
    </div>

    <div class="qa">

      <!-- Q4: Backend -->
      <div class="qa-card">
        <div class="q-label">سؤال محتمل</div>
        <div class="q-text">"إيش الـ backend اللي يخزّن البيانات؟"</div>

        <div class="block b-glos">
          <span class="b-label">شرح المصطلحات</span>
          <div class="b-body">
            <span class="term"><strong>Backend</strong> = الطبقة اللي تخزّن وتدير البيانات (مقابل Frontend = الواجهة).</span>
            <span class="term"><strong>SharePoint Lists</strong> = قواعد بيانات شكل جداول داخل SharePoint — كل صف يصير "list item".</span>
            <span class="term"><strong>SP REST API</strong> = الواجهة البرمجية اللي SharePoint يفتحها للقراءة والكتابة.</span>
            <span class="term"><strong>Power Automate</strong> = خدمة Microsoft لتشغيل workflows (موافقات، إشعارات، تنبيهات).</span>
          </div>
        </div>

        <div class="block b-answer">
          <span class="b-label">ردّك المختصر</span>
          <div class="b-body">
            "<strong>SharePoint Online</strong> فيه 4 lists رئيسية:
            <em>PMO_Projects · PMO_Departments · PMO_Users · New Project Request</em>.
            البيانات المعقّدة (Milestones, Risks, Documents) مخزّنة كـ <strong>JSON في Multi-line text fields</strong>.
            الاتصال عبر <strong>SP REST API</strong> مع MSAL token. الـ approval workflows على <strong>Power Automate</strong>."
          </div>
        </div>

        <div class="block b-ask">
          <span class="b-label">سؤالك لهم</span>
          <div class="b-body">
            "تبون نخلّي SP كـ backend، أو ننقل لـ <em>database حقيقية</em> (مثل Cosmos DB / PostgreSQL / SQL Server)؟"
          </div>
        </div>
      </div>

      <!-- Q5: Testing -->
      <div class="qa-card">
        <div class="q-label">سؤال محتمل</div>
        <div class="q-text">"إيش الـ test coverage؟ كيف تتأكد من الجودة؟"</div>

        <div class="block b-glos">
          <span class="b-label">شرح المصطلحات</span>
          <div class="b-body">
            <span class="term"><strong>Unit Test</strong> = اختبار لدالة وحدة (function). يأخذ مدخل، يتحقّق من المخرج.</span>
            <span class="term"><strong>E2E Test</strong> = End-to-End — اختبار يحاكي مستخدم حقيقي عبر المتصفّح (Playwright, Cypress).</span>
            <span class="term"><strong>Vitest</strong> = framework حديث لـ unit testing على Vite. سريع.</span>
            <span class="term"><strong>Coverage</strong> = النسبة المئوية للكود اللي مشمول بالاختبارات.</span>
          </div>
        </div>

        <div class="block b-answer">
          <span class="b-label">ردّك المختصر</span>
          <div class="b-body">
            "<strong>46 unit test</strong> على محرّك الـ IPI بـ <strong>Vitest</strong> (الملف في <code>src/utils/metrics.test.js</code>).
            الاختبارات تغطي: <em>SPI، CPI، MCI، gate-aware logic، roadmap penalty، dept rollup، portfolio rollup، time-weighted IPI</em>.
            <strong>ما عندي E2E tests بعد</strong> — هذي مرحلة أكمّلها مع فريقكم لو تبون."
          </div>
        </div>

        <div class="block b-ask">
          <span class="b-label">سؤالك لهم</span>
          <div class="b-body">
            "تبون نضيف <em>Playwright</em> أو <em>Cypress</em> للـ E2E؟ وفي عندكم QA team جاهز يستلم الاختبارات؟"
          </div>
        </div>
      </div>

      <!-- Q6: Security -->
      <div class="qa-card">
        <div class="q-label">سؤال محتمل</div>
        <div class="q-text">"كيف تتأكد من الأمان؟ وين تخزّن الـ secrets؟"</div>

        <div class="block b-glos">
          <span class="b-label">شرح المصطلحات</span>
          <div class="b-body">
            <span class="term"><strong>.env file</strong> = ملف فيه متغيّرات حسّاسة (URLs، Client IDs). <strong>لا يُرفع لـ GitHub أبداً</strong>.</span>
            <span class="term"><strong>VITE_ prefix</strong> = أي متغيّر يبدأ بـ <code>VITE_</code> يصير <em>public في bundle</em>. لذلك Client IDs نعم، أسرار حقيقية لا.</span>
            <span class="term"><strong>HTTPS</strong> = بروتوكول مشفّر — Vercel يوفّره تلقائياً، وأي استضافة محترمة نفس الشي.</span>
            <span class="term"><strong>CORS</strong> = إعدادات SharePoint للسماح للبورتل بقراءة البيانات من نطاق مختلف.</span>
          </div>
        </div>

        <div class="block b-answer">
          <span class="b-label">ردّك المختصر</span>
          <div class="b-body">
            "الـ <em>secrets</em> في ملف <code>.env</code> غير محفوظ على GitHub. كل المتغيّرات على <code>VITE_</code> = public في الـ bundle (Client IDs آمنة كذا، لكن ما فيه أسرار حقيقية أبداً).
            الـ <strong>token acquisition</strong> client-side عبر MSAL. الـ SharePoint permissions على مستوى المستخدم نفسه — البورتل ما يتجاوز صلاحياته."
          </div>
        </div>

        <div class="block b-ask">
          <span class="b-label">سؤالك لهم</span>
          <div class="b-body">
            "عندكم <em>secrets manager</em> (Azure Key Vault مثلاً) تبون نمرّر الإعدادات منه بدل ملف .env؟"
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- ══════════ FALLBACK ══════════ -->
  <div class="sec">
    <div class="sec-h priority">
      <span class="ix">7</span>
      <h2>لو سألوك سؤال ما تعرف جوابه</h2>
      <span class="meta">جواب ثقة، مش جواب اعتذار</span>
    </div>
    <div class="fallback">
      <div class="h">💡 الجواب الذهبي</div>
      <p>
        "أرجع لكم بالتفصيل بعد الميتنق. عندنا <strong>4 PDFs توثيقية</strong> رسمية في
        <code>Desktop/PMO-Portal-Deliverables</code>:
        <strong>Tech Overview</strong> (المعمارية كاملة) ·
        <strong>IPI Methodology</strong> (19 صفحة على الحسابات الرياضية) ·
        <strong>Testing 101</strong> (شرح كل الـ unit tests) ·
        <strong>GRC Admin Guide</strong> (إدارة المخاطر).
        راح أبعتها لكم اليوم على الإيميل."
      </p>
    </div>
  </div>

  <div class="foot">
    <span>ورقة ميتنق المطوّرين — PMO Portal · Tree Digital Insurance</span>
    <span>الصفحة 3 من 3 — التوفيق ✦</span>
  </div>
</div>

</body>
</html>`;

const outHtml = path.join('C:', 'Users', 'nioh1', 'Desktop', 'PMO-Portal-Deliverables', 'Meeting-Cheat-Sheet-AR.html');
fs.writeFileSync(outHtml, html, 'utf8');
console.log('Wrote HTML:', outHtml, '·', html.length, 'bytes');
