// Builds a comprehensive GRC Admin guide as a polished HTML file.
// Then (try to) convert to PDF using puppeteer. If puppeteer isn't available,
// keep the HTML so the user can print to PDF from Chrome (Ctrl+P → Save as PDF).
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>دليل الاستخدام — GRC Risk Intelligence Dashboard</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
    color: #1a1a1a;
    line-height: 1.7;
    margin: 0;
    padding: 24px;
    font-size: 14px;
  }
  .cover {
    background: linear-gradient(135deg, #003932 0%, #006b5d 100%);
    color: #fff;
    padding: 80px 50px;
    margin: -24px -24px 40px;
    page-break-after: always;
    text-align: center;
  }
  .cover h1 { font-size: 38px; margin: 0 0 12px; font-weight: 900; }
  .cover .sub { font-size: 17px; opacity: 0.9; margin-bottom: 30px; }
  .cover .badge {
    display: inline-block;
    background: rgba(255,255,255,0.18);
    border: 1.5px solid rgba(255,255,255,0.35);
    padding: 10px 22px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 700;
    margin-top: 50px;
  }
  .cover .icon { font-size: 80px; margin-bottom: 24px; }
  h1 {
    color: #003932;
    border-bottom: 3px solid #003932;
    padding-bottom: 8px;
    margin-top: 36px;
    font-size: 24px;
  }
  h2 {
    color: #006b5d;
    margin-top: 28px;
    font-size: 18px;
    border-right: 4px solid #006b5d;
    padding-right: 10px;
  }
  h3 {
    color: #1a1a1a;
    margin-top: 20px;
    font-size: 15px;
  }
  p { margin: 10px 0; }
  ol, ul { margin: 10px 0; padding-right: 24px; }
  li { margin: 6px 0; }
  code {
    background: #f3f4f6;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 12px;
    color: #003932;
    direction: ltr;
    display: inline-block;
  }
  .step {
    background: #f9fafb;
    border-right: 4px solid #003932;
    padding: 14px 18px;
    margin: 14px 0;
    border-radius: 6px;
  }
  .tip {
    background: #fef3c7;
    border-right: 4px solid #d97706;
    padding: 14px 18px;
    margin: 14px 0;
    border-radius: 6px;
  }
  .warn {
    background: #fee2e2;
    border-right: 4px solid #dc2626;
    padding: 14px 18px;
    margin: 14px 0;
    border-radius: 6px;
  }
  .info {
    background: #dbeafe;
    border-right: 4px solid #2563eb;
    padding: 14px 18px;
    margin: 14px 0;
    border-radius: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 13px;
  }
  th {
    background: #003932;
    color: #fff;
    padding: 10px 12px;
    text-align: right;
    font-weight: 700;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  tr:nth-child(even) td { background: #f9fafb; }
  .chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 14px;
    font-size: 11px;
    font-weight: 700;
    margin: 0 2px;
  }
  .chip-green { background: #dcfce7; color: #15803d; }
  .chip-amber { background: #fef3c7; color: #854d0e; }
  .chip-red { background: #fee2e2; color: #991b1b; }
  .toc {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 20px 24px;
    margin: 24px 0;
  }
  .toc h2 { margin-top: 0; border: none; padding: 0; }
  .toc ol { padding-right: 20px; }
  .toc li { margin: 4px 0; font-size: 13px; }
  .page-break { page-break-before: always; }
  .small { font-size: 12px; color: #6b7280; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }
  .footer {
    text-align: center;
    color: #6b7280;
    font-size: 11px;
    margin-top: 50px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
  }
</style>
</head>
<body>

<!-- ════════════ COVER ════════════ -->
<div class="cover">
  <div class="icon">🛡️</div>
  <h1>GRC Risk Intelligence Dashboard</h1>
  <div class="sub">دليل الاستخدام الشامل للمسؤول الإداري</div>
  <div class="sub" style="font-size:14px;opacity:0.7">Tree Digital Insurance Company · PMO Portal</div>
  <div class="badge">إصدار يونيو 2026</div>
</div>

<!-- ════════════ TOC ════════════ -->
<div class="toc">
  <h2>المحتويات</h2>
  <ol>
    <li>مقدمة: ما هو الـ GRC Dashboard؟</li>
    <li>الوصول للوحة التحكم</li>
    <li>فهم الواجهة الرئيسية والـ KPIs</li>
    <li>الـ KRI Status Board (لوحة الحالة)</li>
    <li>الفلاتر والبحث</li>
    <li>إدارة الـ KRIs: إضافة، تعديل، حذف</li>
    <li>تردد الإبلاغ (Reporting Frequency)</li>
    <li>إدارة القراءات الشهرية/الربعية</li>
    <li>نظام الـ RAG التلقائي (Auto-RAG)</li>
    <li>الرسم البياني للاتجاه (Trend Chart)</li>
    <li>إدارة المخاطر (Risk Register)</li>
    <li>شهية المخاطر (Risk Appetite)</li>
    <li>الـ Audit Findings والـ Corrective Actions</li>
    <li>أسئلة شائعة وحلول للمشاكل</li>
  </ol>
</div>

<!-- ════════════ 1. INTRO ════════════ -->
<h1>١. مقدمة: ما هو الـ GRC Dashboard؟</h1>
<p>
الـ GRC Risk Intelligence Dashboard هي اللوحة المسؤولة عن متابعة:
</p>
<ul>
  <li><strong>KRIs (Key Risk Indicators):</strong> ٩١ مؤشر مخاطر رئيسي موزّعة على ١٢ قسم.</li>
  <li><strong>القراءات الدورية:</strong> قيم شهرية/ربعية/نصف سنوية/سنوية لكل KRI.</li>
  <li><strong>سجل المخاطر:</strong> المخاطر النشطة وتقييمها (احتمالية × تأثير).</li>
  <li><strong>شهية المخاطر:</strong> الحدود المقبولة من المخاطر حسب الفئة.</li>
  <li><strong>نتائج التدقيق:</strong> ملاحظات الـ Audit النشطة.</li>
  <li><strong>الإجراءات التصحيحية:</strong> الـ Corrective Actions ونسبة إنجازها.</li>
</ul>

<div class="info">
<strong>الهدف:</strong> توفير صورة واحدة شاملة عن صحة المخاطر في الشركة، تساعد على اكتشاف الاختراقات قبل أن تصبح أزمات، وتوثيق العمل لمتطلبات الحوكمة والامتثال (مهم لاستعداد ترخيص ٢٠٢٧).
</div>

<!-- ════════════ 2. ACCESS ════════════ -->
<h1>٢. الوصول للوحة التحكم</h1>
<ol>
  <li>افتح الرابط الإنتاجي للـ PMO Portal من أي متصفّح حديث (Chrome / Edge).</li>
  <li>سجّل الدخول بحسابك الـ Microsoft 365 الخاص بالشركة.</li>
  <li>من القائمة الجانبية، اختر <strong>GRC</strong> (يظهر فقط للمستخدمين أصحاب صلاحية GRC أو GRC Admin).</li>
  <li>سيتم تحميل لوحة التحكم وعرض البيانات الحالية من SharePoint مباشرة.</li>
</ol>

<div class="tip">
<strong>صلاحيات الأدوار:</strong>
<ul style="margin:8px 0">
  <li><strong>GRC:</strong> عرض فقط — لا يمكنه التعديل.</li>
  <li><strong>GRC Admin:</strong> صلاحية كاملة (إضافة، تعديل، حذف).</li>
</ul>
</div>

<!-- ════════════ 3. MAIN UI ════════════ -->
<h1>٣. فهم الواجهة الرئيسية والـ KPIs</h1>
<p>عند فتح اللوحة ترى في الأعلى ٥ بطاقات KPI ملوّنة:</p>
<table>
<thead><tr><th>البطاقة</th><th>المعنى</th></tr></thead>
<tbody>
<tr><td><strong>Total KRIs</strong></td><td>إجمالي المؤشرات النشطة (يصبح "Filtered" مع عداد عند تفعيل أي فلتر).</td></tr>
<tr><td><strong>Breaching — Red</strong></td><td>عدد المؤشرات التي تخطّت الحد الأحمر في آخر قراءة.</td></tr>
<tr><td><strong>At Risk — Amber</strong></td><td>عدد المؤشرات في المنطقة الصفراء.</td></tr>
<tr><td><strong>Within Limits</strong></td><td>عدد المؤشرات في المنطقة الخضراء (سليمة).</td></tr>
<tr><td><strong>Escalations Required</strong></td><td>القراءات المعلَّمة "Escalation required" — تحتاج تصعيد إداري.</td></tr>
</tbody>
</table>

<div class="info">
<strong>ملاحظة مهمة:</strong> أرقام البطاقات تعكس <strong>النتائج المفلترة</strong>. إذا اخترت قسم Cyber فقط، الأرقام تظهر مؤشرات Cyber فقط.
</div>

<!-- ════════════ 4. KRI BOARD ════════════ -->
<h1>٤. الـ KRI Status Board (لوحة الحالة)</h1>
<p>الجدول الرئيسي يعرض كل المؤشرات النشطة بأعمدة:</p>
<table>
<thead><tr><th>العمود</th><th>الوصف</th></tr></thead>
<tbody>
<tr><td>KRI Name</td><td>اسم المؤشر + معرّفه (KRI-001 مثلاً). إذا التردد غير شهري تظهر شارة 🗓.</td></tr>
<tr><td>Department</td><td>القسم المسؤول (Compliance, IT, Cyber, ...).</td></tr>
<tr><td>Category</td><td>الفئة العامة (Operational, Strategic, Compliance...).</td></tr>
<tr><td>Sub-Category</td><td>الفئة الفرعية (Fraud, Regulatory, Process...).</td></tr>
<tr><td>Current Value</td><td>قيمة آخر قراءة + وحدة القياس.</td></tr>
<tr><td>RAG</td><td>الحالة (<span class="chip chip-green">Green</span> <span class="chip chip-amber">Amber</span> <span class="chip chip-red">Red</span>) من آخر قراءة.</td></tr>
<tr><td>Trend</td><td>اتجاه التغيير (▲ Improving، ▼ Worsening، ━ Stable).</td></tr>
<tr><td>Period</td><td>الفترة الزمنية لآخر قراءة (2026-06 مثلاً).</td></tr>
<tr><td>Escalate</td><td>هل تحتاج هذه القراءة تصعيداً (⚠ Yes أو —).</td></tr>
</tbody>
</table>

<p>عند الضغط على أي سطر يظهر <strong>Trend Chart</strong> أسفل الجدول مع كل القراءات التاريخية.</p>

<!-- ════════════ 5. FILTERS ════════════ -->
<h1>٥. الفلاتر والبحث</h1>
<p>فوق الجدول مباشرة يوجد شريط فلاتر يسمح بتضييق النتائج:</p>
<ul>
  <li><strong>🔍 Search:</strong> اكتب أي كلمة من الاسم، الـ ID، صيغة الحساب، أو المصدر.</li>
  <li><strong>Department:</strong> اختر قسم واحد أو أكثر (متعدد الخيارات).</li>
  <li><strong>Category:</strong> فلتر بالفئة الرئيسية.</li>
  <li><strong>Sub-Cat:</strong> فلتر بالفئة الفرعية.</li>
  <li><strong>RAG:</strong> فلتر بحالة المؤشر الحالية.</li>
</ul>

<div class="step">
<strong>مثال:</strong> لرؤية كل مؤشرات Cyber Security التي تخترق الحدود الحمراء:
<ol>
  <li>اضغط فلتر <strong>Department</strong> → اختر <strong>Cyber</strong>.</li>
  <li>اضغط فلتر <strong>RAG</strong> → اختر <strong>Red</strong>.</li>
  <li>الجدول يعرض النتائج فوراً، و KPIs أعلى تتحدّث.</li>
  <li>لإلغاء الفلاتر دفعة واحدة: زر <strong>✕ Clear all</strong>.</li>
</ol>
</div>

<!-- ════════════ 6. KRI MANAGEMENT ════════════ -->
<h1>٦. إدارة الـ KRIs: إضافة، تعديل، حذف</h1>

<h2>أ. إضافة KRI جديد</h2>
<ol>
  <li>اضغط زر <strong>+ Add KRI</strong> أعلى يمين لوحة الـ KRI Status Board.</li>
  <li>سيفتح نموذج "New KRI" بحقول فارغة (الـ KRI ID يُولَّد تلقائياً، مثل KRI-092).</li>
  <li>عبّئ الحقول:
    <ul>
      <li><strong>KRI Name:</strong> اسم وصفي للمؤشر (إلزامي).</li>
      <li><strong>Category:</strong> اختر من القائمة (Financial, Operational, Compliance, IT, Strategic, Reputational, Conduct of Business).</li>
      <li><strong>Business Unit / Department:</strong> القسم.</li>
      <li><strong>Risk Category Level 1:</strong> الفئة الرئيسية كما وردت في وثائق الشركة.</li>
      <li><strong>Sub-Category:</strong> الفئة الفرعية.</li>
      <li><strong>Metric:</strong> الصيغة الرياضية للقياس.</li>
      <li><strong>Base Data:</strong> ما هي البيانات المطلوبة لحساب المؤشر؟</li>
      <li><strong>Data Source:</strong> القسم أو النظام الذي يوفّر البيانات.</li>
      <li><strong>Unit:</strong> وحدة القياس (%، days، count...).</li>
      <li><strong>Thresholds:</strong> Green / Amber / Red — انظر القسم التالي للتفاصيل.</li>
      <li><strong>Threshold Direction:</strong> هل القيم الأقل أفضل، أم الأعلى أفضل؟</li>
      <li><strong>Reporting Frequency:</strong> شهري / ربعي / نصف سنوي / سنوي.</li>
      <li><strong>Active KRI:</strong> مفعّل افتراضياً.</li>
    </ul>
  </li>
  <li>اضغط <strong>Create KRI</strong> — يحفظ في SharePoint وتظهر فوراً في الجدول.</li>
</ol>

<h2>ب. تعديل KRI موجود</h2>
<ol>
  <li>فعّل وضع التعديل: اضغط <strong>✎ Global Edit</strong> أعلى الصفحة (يصبح <strong>✓ Edit Mode ON</strong>).</li>
  <li>بجنب كل KRI في الجدول يظهر زرّان: <strong>Edit</strong> و <strong>🗑</strong>.</li>
  <li>اضغط <strong>Edit</strong> للمؤشر المطلوب → يفتح النموذج بنفس الحقول والقيم الحالية.</li>
  <li>عدّل ما تشاء واضغط <strong>Save Changes</strong>.</li>
</ol>

<h2>ج. حذف KRI</h2>
<ol>
  <li>في وضع Global Edit، اضغط زر <strong>🗑</strong> بجنب KRI.</li>
  <li>تظهر رسالة تأكيد — اقرأها جيداً.</li>
  <li>اضغط <strong>OK</strong> للحذف النهائي (لا يمكن التراجع).</li>
</ol>

<div class="warn">
<strong>تنبيه:</strong> حذف KRI لا يحذف القراءات السابقة من قائمة <code>GRC_KRI_Readings</code>. تبقى محفوظة لكن لا تظهر في الواجهة. لإزالتها نهائياً، يتطلب تدخّل تقني.
</div>

<!-- ════════════ 7. FREQUENCY ════════════ -->
<h1>٧. تردد الإبلاغ (Reporting Frequency)</h1>
<p>كل KRI له تردد إبلاغ خاص. الإعداد الصحيح يجعل فورم إدخال القراءة يتأقلم تلقائياً.</p>
<table>
<thead><tr><th>التردد</th><th>صيغة الفترة</th><th>مثال</th></tr></thead>
<tbody>
<tr><td>Monthly</td><td>YYYY-MM</td><td>2026-06</td></tr>
<tr><td>Quarterly</td><td>YYYY-QN</td><td>2026-Q2</td></tr>
<tr><td>Semi-Annual</td><td>YYYY-HN</td><td>2026-H1</td></tr>
<tr><td>Annual</td><td>YYYY</td><td>2026</td></tr>
</tbody>
</table>

<div class="info">
كل المؤشرات الـ ٩١ معبّأة افتراضياً بـ <strong>Monthly</strong>. لتغيير التردد لمؤشر معيّن:
<ol>
  <li>فعّل Global Edit.</li>
  <li>اضغط Edit للمؤشر.</li>
  <li>غيّر قيمة <strong>Reporting Frequency</strong>.</li>
  <li>احفظ.</li>
</ol>
بعدها، شارة 🗓 ستظهر بجنب اسم المؤشر في الجدول للتذكير.
</div>

<!-- ════════════ 8. READINGS ════════════ -->
<h1>٨. إدارة القراءات الشهرية/الربعية</h1>

<h2>أ. إضافة قراءة جديدة</h2>
<ol>
  <li>في الجدول، اضغط زر <strong>+ Reading</strong> بجنب الـ KRI المطلوب.</li>
  <li>يفتح نموذج "Add KRI Reading" مع الحقول التالية:
    <ul>
      <li><strong>Actual Value:</strong> القيمة الفعلية للقراءة (إلزامي).</li>
      <li><strong>Previous Value:</strong> قيمة القراءة السابقة (اختياري — للمقارنة).</li>
      <li><strong>Period:</strong> الفترة الزمنية — يتأقلم تلقائياً حسب تردد الـ KRI.</li>
      <li><strong>RAG Status:</strong> الحالة (يُحسب تلقائياً إذا توفّرت الشروط — انظر القسم التالي).</li>
      <li><strong>Trend:</strong> الاتجاه (Improving, Stable, Worsening).</li>
      <li><strong>Comments:</strong> ملاحظات اختيارية (تفسير، خطة، إجراء...).</li>
      <li><strong>Escalation required:</strong> ✓ إذا كانت القراءة تستوجب تصعيد إداري.</li>
    </ul>
  </li>
  <li>اضغط <strong>Save Reading</strong>.</li>
</ol>

<div class="tip">
<strong>إدخال بيانات تاريخية:</strong> غيّر حقل <strong>Period</strong> لأي شهر/ربع/سنة في الماضي — النظام يقبل ويحفظ. الترتيب لا يفرق؛ النظام يرتّب حسب الفترة تلقائياً.
</div>

<h2>ب. تعديل قراءة موجودة</h2>
<ol>
  <li>اضغط على سطر الـ KRI في الجدول الرئيسي — يفتح Trend Chart.</li>
  <li>تحت الرسم يظهر قسم <strong>All Readings (N)</strong> فيه كل القراءات.</li>
  <li>اضغط <strong>Edit</strong> بجنب القراءة المطلوبة.</li>
  <li>عدّل الحقول واضغط <strong>Save Changes</strong>.</li>
</ol>

<h2>ج. حذف قراءة</h2>
<ol>
  <li>افتح الـ KRI وانتقل لقائمة القراءات.</li>
  <li>اضغط <strong>🗑</strong> بجنب القراءة.</li>
  <li>أكّد الحذف.</li>
</ol>

<!-- ════════════ 9. AUTO-RAG ════════════ -->
<h1>٩. نظام الـ RAG التلقائي (Auto-RAG)</h1>
<p>عند إدخال قراءة، النظام يحاول حساب الـ RAG تلقائياً ووضعه في الـ dropdown. تظهر ملاحظة <code>💡 auto: Green</code> فوق الحقل.</p>

<h2>شروط عمل الـ Auto-RAG:</h2>
<ol>
  <li><strong>Green Threshold و Red Threshold يكونان أرقاماً صريحة</strong> (مثل 5، 100، 0.95).</li>
  <li>الـ <strong>Threshold Direction</strong> محدّد (Lower / Higher is better).</li>
</ol>

<h2>متى لا يعمل (ويبقى يدوي):</h2>
<ul>
  <li>إذا كانت العتبات نصوصاً مثل <code>&gt;=1</code>، <code>In Between</code>، <code>&lt;5%</code>.</li>
  <li>إذا تركت أحد العتبات فارغاً.</li>
</ul>

<div class="info">
<strong>مثال يعمل:</strong><br>
KRI فيه: Green=5، Amber=3، Red=1، Direction="Lower is better"<br>
عند إدخال قيمة 4 → 💡 auto: <span class="chip chip-amber">Amber</span><br>
عند إدخال قيمة 6 → 💡 auto: <span class="chip chip-green">Green</span><br>
عند إدخال قيمة 1 → 💡 auto: <span class="chip chip-red">Red</span>
</div>

<div class="warn">
<strong>تذكير:</strong> الـ Auto-RAG اقتراح ذكي وليس قانوناً. تستطيع دائماً تغيير الـ dropdown يدوياً قبل الحفظ. إذا كنت غير متأكد من صحة الاقتراح، راجع العتبات والـ Direction أولاً.
</div>

<!-- ════════════ 10. TREND ════════════ -->
<h1>١٠. الرسم البياني للاتجاه (Trend Chart)</h1>
<p>عند الضغط على أي KRI في الجدول، يظهر تحته رسم بياني خطّي يعرض تطوّر القيمة عبر الفترات.</p>
<ul>
  <li><strong>المحور الأفقي (X):</strong> الفترات الزمنية (مثل May 2026, Jun 2026).</li>
  <li><strong>المحور الرأسي (Y):</strong> القيمة الفعلية للقراءة.</li>
  <li><strong>خطوط مرجعية ملوّنة:</strong> تظهر تلقائياً إذا كانت العتبات أرقاماً:
    <ul>
      <li>أخضر متقطّع: عتبة Green.</li>
      <li>أصفر متقطّع: عتبة Amber.</li>
      <li>أحمر متقطّع: عتبة Red.</li>
    </ul>
  </li>
</ul>
<p>أسفل الرسم تظهر قائمة <strong>All Readings</strong> مع زرّي Edit و 🗑 لكل قراءة.</p>

<!-- ════════════ 11. RISK REGISTER ════════════ -->
<h1>١١. إدارة المخاطر (Risk Register)</h1>
<p>قسم Risk Register يعرض المخاطر النشطة في الشركة مع تقييمها.</p>
<ul>
  <li><strong>Top Risks by Score:</strong> أعلى المخاطر حسب الـ score (احتمالية × تأثير).</li>
  <li><strong>Edit:</strong> بجنب كل خطر زر تعديل لتحديث:
    <ul>
      <li>الاحتمالية (1-5)</li>
      <li>التأثير (1-5)</li>
      <li>الحالة (Open, Mitigated, Closed)</li>
      <li>اختراق شهية المخاطر (Risk Appetite Breached)</li>
      <li>ملخّص الإجراءات التخفيفية</li>
    </ul>
  </li>
  <li>الـ <strong>Risk Heatmap</strong> يعرض توزّع المخاطر بمصفوفة 5×5 (احتمالية × تأثير).</li>
</ul>

<!-- ════════════ 12. APPETITE ════════════ -->
<h1>١٢. شهية المخاطر (Risk Appetite)</h1>
<p>تعرض الحدود المقبولة من المخاطر لكل فئة (Strategic, Financial, Compliance...).</p>
<ul>
  <li><strong>Exposure / Limit:</strong> التعرّض الحالي مقابل الحد الأقصى المقبول.</li>
  <li><strong>الحالة:</strong> <span class="chip chip-green">Within Appetite</span> أو <span class="chip chip-amber">Near Limit</span> أو <span class="chip chip-red">Breached</span>.</li>
  <li>اضغط Edit لتحديث:
    <ul>
      <li>الـ Maximum Tolerable Score</li>
      <li>الـ Current Exposure Score</li>
      <li>الـ Appetite Status</li>
    </ul>
  </li>
</ul>

<!-- ════════════ 13. AUDIT ════════════ -->
<h1>١٣. الـ Audit Findings والـ Corrective Actions</h1>

<h2>Audit Findings Summary</h2>
<p>ملخّص نتائج التدقيق الداخلي مع:</p>
<ul>
  <li><strong>Open:</strong> عدد الملاحظات النشطة.</li>
  <li><strong>Critical / High:</strong> ذات الخطورة العالية.</li>
  <li><strong>Overdue:</strong> متجاوزة موعدها.</li>
  <li><strong>Closed:</strong> المغلقة.</li>
</ul>
<p>كل ملاحظة فيها: الـ Title، القسم، تاريخ الاستحقاق، الحالة.</p>

<h2>Corrective Actions Progress</h2>
<p>متابعة الإجراءات التصحيحية المرتبطة بنتائج التدقيق:</p>
<ul>
  <li><strong>Total / Completed / Overdue:</strong> أرقام ملخّصة.</li>
  <li><strong>Overall Completion %:</strong> نسبة الإنجاز الكلي.</li>
  <li>كل إجراء يعرض الـ Title، التاريخ المستهدف، ونسبة الإنجاز كشريط ملوّن.</li>
</ul>

<!-- ════════════ 14. FAQ ════════════ -->
<h1>١٤. أسئلة شائعة وحلول للمشاكل</h1>

<h2>س: أضفت قراءة لكنها لا تظهر في الجدول؟</h2>
<p>اضغط زر <strong>↻ Refresh</strong> أعلى الصفحة. الجدول يعرض آخر قراءة فقط، فإذا أضفت قراءة لفترة أقدم، قد تجدها في Trend Chart فقط (وليس في عمود Current Value).</p>

<h2>س: الـ Auto-RAG اقترح قيمة خاطئة؟</h2>
<p>تحقّق من العتبات والـ Direction في فورم Edit KRI. لو العتبات نصوص لا أرقام، الـ Auto-RAG لا يعمل أصلاً وتبقى يدوياً.</p>

<h2>س: لا أستطيع تعديل ولا حذف؟</h2>
<p>تحقّق من أنك سجّلت الدخول بصلاحية <strong>GRC Admin</strong>. أيضاً تأكّد من تفعيل وضع <strong>✓ Edit Mode ON</strong> من زر Global Edit.</p>

<h2>س: حذفت KRI بالخطأ — كيف أستعيده؟</h2>
<p>الحذف نهائي ولا يوجد Undo في الواجهة. لو حصل بالخطأ، تواصل مع مسؤول SharePoint للاستعادة من سلة المحذوفات (Recycle Bin) خلال ٩٣ يوماً.</p>

<h2>س: الرسم البياني يظهر خطوطاً مرجعية فقط لبعض الـ KRIs؟</h2>
<p>الخطوط المرجعية تظهر فقط حين تكون العتبات أرقاماً قابلة للقراءة. للنصوص (<code>&gt;=1</code>، <code>In Between</code>...) لا تظهر — هذا تصرّف مقصود لتجنّب رسم خاطئ.</p>

<h2>س: كيف أضيف قراءات شهرية كثيرة دفعة واحدة؟</h2>
<p>للعدد القليل (أقل من ٥٠ قراءة) — يدوي من زر + Reading. للعدد الكبير، تواصل مع الفريق التقني لإعداد سكربت Bulk Import من ملف Excel.</p>

<!-- ════════════ FOOTER ════════════ -->
<div class="footer">
  <p>Tree Digital Insurance Company — Internal Use Only</p>
  <p>دليل GRC Risk Intelligence Dashboard · إصدار يونيو ٢٠٢٦</p>
</div>

</body>
</html>`;

const outPath = path.join(__dirname, '..', '..', 'GRC-Admin-Guide.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath);
console.log('Bytes:', html.length);
