# PMO Portal — Troubleshooting Guide

> **كيف تستخدم هذا الملف:**
> ابحث بالـ error message اللي تشوفه، أو اقرأ القسم المناسب للمشكلة.
> كل مشكلة مكتوب فيها: متى تحدث، ليه تحدث، وكيف تحلها.

---

## الفهرس

1. [مشاكل SharePoint — الاتصال والبيانات](#1-مشاكل-sharepoint--الاتصال-والبيانات)
2. [مشاكل المصادقة (Azure AD / MSAL)](#2-مشاكل-المصادقة-azure-ad--msal)
3. [مشاكل الـ SP Fields والبيانات](#3-مشاكل-الـ-sp-fields-والبيانات)
4. [مشاكل الصلاحيات (RBAC)](#4-مشاكل-الصلاحيات-rbac)
5. [مشاكل IPI والحسابات](#5-مشاكل-ipi-والحسابات)
6. [مشاكل الـ Environment Variables](#6-مشاكل-الـ-environment-variables)
7. [مشاكل البناء والنشر (Build & Deploy)](#7-مشاكل-البناء-والنشر-build--deploy)
8. [مشاكل واجهة المستخدم (UI)](#8-مشاكل-واجهة-المستخدم-ui)
9. [مشاكل لوحة GRC](#9-مشاكل-لوحة-grc)
10. [أوامر مفيدة للتشخيص السريع](#10-أوامر-مفيدة-للتشخيص-السريع)

---

## 1. مشاكل SharePoint — الاتصال والبيانات

---

### ❌ `SP fetch failed: 401 — Unauthorized`

**متى تحدث:**
عند أي عملية قراءة أو كتابة على SharePoint — عند فتح البورتال أو حفظ مشروع.

**ليه تحدث:**
- الـ access token منتهي أو غير موجود
- المستخدم لم يوافق على صلاحية `AllSites.Write` بعد
- الـ session storage اتمسح (أغلق التاب وفتحه من جديد)

**الحل:**
1. افتح DevTools → Application → Session Storage → امسح كل شيء
2. اعد تسجيل الدخول من جديد
3. إذا ظهرت نافذة consent (موافقة) وافق عليها
4. إذا استمرت المشكلة تحقق أن الـ `AllSites.Write` scope موجود في Azure AD → API Permissions

---

### ❌ `SP fetch failed: 403 — Forbidden`

**متى تحدث:**
بعد تسجيل الدخول بنجاح لكن البيانات ما تجي، أو عند محاولة حفظ/حذف.

**ليه تحدث:**
- المستخدم ليس عضو في موقع SharePoint
- المستخدم عنده Read فقط لكن البورتال يحاول يكتب
- الـ App Registration ما عنده Admin Consent للـ AllSites.Write

**الحل:**
1. تأكد أن المستخدم مضاف في موقع SP → Site Settings → People and Groups
2. تأكد أن Admin Consent ممنوح: Azure Portal → App Registrations → API Permissions → Grant admin consent
3. للكتابة: المستخدم يحتاج صلاحية `Edit` على القائمة على الأقل

---

### ❌ `SP fetch failed: 404 — Not Found` (على list أو field)

**متى تحدث:**
عند محاولة جلب قائمة معينة كـ `PMO_Projects` أو عند حفظ مشروع.

**ليه تحدث:**
- اسم القائمة في `.env` غلط أو فيه مسافة زيادة
- القائمة اتحذفت أو انقلت
- الـ field الموجود في الكود غير موجود في SP (مثل `IPIHistoryJSON`)

**الحل لمشكلة القائمة:**
```
1. افتح SharePoint → Site Contents
2. انسخ اسم القائمة بالضبط (حساس للحروف الكبيرة/الصغيرة)
3. حدّث .env:
   VITE_SP_PROJECTS_LIST=PMO_Projects    ← بدون مسافات أو أحرف زيادة
4. أعد البناء: npm run build
```

**الحل لمشكلة الـ Field:**
افتح Browser Console من صفحة SharePoint وشغّل:
```javascript
// تحقق من وجود الـ field
fetch(`${_spPageContextInfo.siteAbsoluteUrl}/_api/web/lists/getbytitle('PMO_Projects')/fields?$filter=InternalName eq 'IPIHistoryJSON'&$select=InternalName,Title`)
  .then(r=>r.json()).then(d=>console.log(d.value))
```
إذا النتيجة فارغة = الـ field ما موجود → أضفه بالسكريبت المناسب.

---

### ❌ `SP fetch failed: 400 — Bad Request`

**متى تحدث:**
عند حفظ مشروع أو تحديثه (create أو update).

**ليه تحدث:**
- ترسل field غير موجود في SP (field في الكود لكن ما أُنشئ في SharePoint)
- نوع البيانات غلط (مثلاً: ترسل نص لحقل رقمي)
- قيمة الـ JSON المخزنة كبيرة جداً (تجاوزت 255 حرف في حقل Single Line)

**الحل:**
1. افتح DevTools → Network → ابحث عن الطلب الفاشل → اقرأ الـ Response Body
2. الرسالة عادةً تقول: `"The property 'FieldName' does not exist on type 'SP.Data.PMO_x005f_ProjectsListItem'"`
3. الحل: أضف الـ field الناقص في SP باستخدام السكريبت:
```javascript
// شغّله من Browser Console على صفحة SP
const siteUrl = _spPageContextInfo.siteAbsoluteUrl;
const listName = "PMO_Projects";
const fieldName = "FieldNameHere"; // غيّر هذا
const fieldType = 3; // 2=Text, 3=Note (multi-line), 6=Integer, 9=Number, 8=Boolean

fetch(`${siteUrl}/_api/web/lists/getbytitle('${listName}')/fields`, {
  method: "POST",
  headers: {
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json;odata=nometadata",
    "X-RequestDigest": document.getElementById("__REQUESTDIGEST")?.value || 
                       (await fetch(`${siteUrl}/_api/contextinfo`, {method:"POST",headers:{"Accept":"application/json;odata=nometadata"}}).then(r=>r.json()).then(d=>d.FormDigestValue))
  },
  body: JSON.stringify({ "__metadata": {"type":"SP.Field"}, "Title": fieldName, "FieldTypeKind": fieldType, "StaticName": fieldName })
}).then(r=>r.json()).then(d=>console.log("✅ Created:", d.Title)).catch(e=>console.error("❌",e));
```

---

### ❌ بيانات المشروع تُحفظ لكن بعض الحقول ما تتحدث

**متى تحدث:**
تحفظ مشروع بنجاح لكن لما تفتحه من جديد بعض الحقول (مثل milestones أو risks) ما اتغيرت.

**ليه تحدث:**
- الحقل موجود في `SP_FIELD_MAP` لكن نوعه في SP هو `Single Line of Text` بدل `Multiple Lines of Text`
- النص الطويل (JSON) اتقطع بعد 255 حرف

**الحل:**
1. في SP → List Settings → تأكد أن الحقول النهاية بـ `JSON` نوعها `Multiple lines of text`
2. الحقول التالية **لازم** تكون `Multiple lines of text`:
   - `GatesJSON`, `MilestonesJSON`, `RisksJSON`, `IssuesJSON`
   - `BenefitsJSON`, `ApprovalsJSON`, `DocumentsJSON`, `UpdatesJSON`
   - `HealthJSON`, `RequiredDocsJSON`, `IPIHistoryJSON`
3. الحقل `ActualFinishDate` يجب أن يكون نوعه `Date` (وليس Text):
   - يُسجَّل تلقائياً عند تغيير المشروع إلى "Completed" — لا تعدّله يدوياً
   - سكريبت الإنشاء: `FieldTypeKind: 4` (Date)

---

### ❌ Pagination — مشاريع ناقصة (أقل من المتوقع)

**متى تحدث:**
عندك مثلاً 600 مشروع لكن البورتال يعرض 500 فقط.

**ليه تحدث:**
الـ default page size هو 500. SP لا يرجع أكثر من 500 item في طلب واحد. البورتال يدعم pagination تلقائياً لكن إذا كانت القيمة أصغر ممكن تضيع items.

**الحل:**
```env
# في .env
VITE_SP_PAGE_SIZE=1000
```
ملاحظة: القيمة القصوى في SP REST API عادةً 5000 للـ large lists.

---

## 2. مشاكل المصادقة (Azure AD / MSAL)

---

### ❌ `No authenticated account — sign in first`

**متى تحدث:**
أي طلب لـ SharePoint قبل تسجيل الدخول، أو بعد انتهاء الـ session.

**ليه تحدث:**
الـ `sessionStorage` اتمسح أو الـ tab اتفتح من جديد. الـ MSAL يخزن الـ token في `sessionStorage` فقط (مش persistent).

**الحل:**
يظهر هذا عادةً كـ redirect تلقائي لصفحة login. إذا ما حصل redirect:
1. افتح DevTools Console وتحقق من وجود `msalInstance.getActiveAccount()` → إذا `null` السبب واضح
2. امسح الـ sessionStorage وأعد تحميل الصفحة

---

### ❌ Loop بين البورتال وصفحة Login مايتوقف

**متى تحدث:**
بعد نشر نسخة جديدة أو تغيير إعدادات Azure.

**ليه تحدث:**
- `VITE_AZURE_REDIRECT_URI` في `.env` مختلف عن الـ URI المسجّل في Azure Portal
- تغيير في الـ scopes يتطلب موافقة جديدة من المستخدم

**الحل:**
1. Azure Portal → App Registrations → Authentication → Redirect URIs
2. تأكد أن القيمة مطابقة **تماماً** لـ `VITE_AZURE_REDIRECT_URI` في `.env`
   - `http://localhost:5173` للـ development
   - `https://your-domain.com` للـ production
3. امسح sessionStorage من DevTools → Application → Storage → Clear site data

---

### ❌ `InteractionRequiredAuthError`

**متى تحدث:**
أثناء العمل المعتاد، فجأة يطلب re-authentication.

**ليه تحدث:**
انتهت صلاحية الـ access token ومحاولة التجديد الصامت (silent) فشلت.

**الحل:**
هذا سلوك طبيعي ومتوقع. البورتال يعملها تلقائياً عبر `acquireTokenRedirect`. المستخدم يُعاد توجيهه لصفحة Microsoft ثم يرجع للبورتال. لا يحتاج تدخل.

إذا حدث بشكل متكرر جداً (كل ساعة): راجع Access Token Lifetime في Azure AD → Token Configuration.

---

### ❌ `CORS error on /token endpoint`

**متى تحدث:**
في بيئة development عند أول محاولة auth.

**ليه تحدث:**
- الـ scope مكتوب بشكل خاطئ (مثلاً `/.default` بدل `/AllSites.Write`)
- `VITE_SP_SITE_URL` فيه trailing slash أو `http` بدل `https`

**الحل:**
```env
# صح
VITE_SP_SITE_URL=https://company.sharepoint.com/sites/PMO-2026

# غلط (trailing slash)
VITE_SP_SITE_URL=https://company.sharepoint.com/sites/PMO-2026/

# غلط (http)
VITE_SP_SITE_URL=http://company.sharepoint.com/sites/PMO-2026
```

---

### ❌ "User assignment required" — المستخدم ما يقدر يدخل التطبيق

**متى تحدث:**
عند نشر التطبيق وإضافة مستخدمين جدد.

**ليه تحدث:**
في Azure AD → Enterprise Applications → تفعيل `User assignment required = Yes` يتطلب إضافة كل مستخدم يدوياً.

**الحل:**
إذا التطبيق داخلي (internal tenant فقط):
- Azure Portal → Enterprise Applications → اسم التطبيق → Properties
- اضبط `User assignment required = No`
- هذا آمن للتطبيقات الداخلية — الصلاحيات تتحكم بها قائمة `PMO_Users` في SP

---

## 3. مشاكل الـ SP Fields والبيانات

---

### ❌ مشروع يُحفظ لكن `milestones` / `risks` / `updates` تظهر فارغة

**متى تحدث:**
أول مرة تستخدم قائمة SP جديدة أو بعد إضافة الـ JSON columns.

**ليه تحدث:**
الـ field موجود في الكود لكن ما أُنشئ في SharePoint بعد.

**قائمة الـ Fields الـ JSON — لازم تكون موجودة كـ Multiple Lines of Text:**

| Field Internal Name | النوع في SP |
|---------------------|-------------|
| `GatesJSON` | Multiple lines of text |
| `MilestonesJSON` | Multiple lines of text |
| `RisksJSON` | Multiple lines of text |
| `IssuesJSON` | Multiple lines of text |
| `BenefitsJSON` | Multiple lines of text |
| `ApprovalsJSON` | Multiple lines of text |
| `DocumentsJSON` | Multiple lines of text |
| `UpdatesJSON` | Multiple lines of text |
| `HealthJSON` | Multiple lines of text |
| `RequiredDocsJSON` | Multiple lines of text |
| `IPIHistoryJSON` | Multiple lines of text |
| `ActualFinishDate` | Date (FieldTypeKind: 4) — write-once, set automatically on Completed |

**سكريبت إضافة كل الـ JSON fields دفعة واحدة:**
```javascript
// شغّله من Browser Console على صفحة SharePoint
const siteUrl = _spPageContextInfo.siteAbsoluteUrl;
const listName = "PMO_Projects";
const fields = [
  "GatesJSON","MilestonesJSON","RisksJSON","IssuesJSON","BenefitsJSON",
  "ApprovalsJSON","DocumentsJSON","UpdatesJSON","HealthJSON","RequiredDocsJSON","IPIHistoryJSON"
];
const digest = await fetch(`${siteUrl}/_api/contextinfo`,{method:"POST",headers:{"Accept":"application/json;odata=nometadata"}}).then(r=>r.json()).then(d=>d.FormDigestValue);
for (const f of fields) {
  const r = await fetch(`${siteUrl}/_api/web/lists/getbytitle('${listName}')/fields`,{
    method:"POST",
    headers:{"Accept":"application/json;odata=nometadata","Content-Type":"application/json;odata=nometadata","X-RequestDigest":digest},
    body: JSON.stringify({"__metadata":{"type":"SP.Field"},"Title":f,"FieldTypeKind":3,"StaticName":f})
  });
  const d = await r.json();
  console.log(r.ok ? `✅ ${f}` : `❌ ${f}: ${d.error?.message?.value}`);
}
```

---

### ❌ `IsRoadmapProject` field — يتحفظ دايم `false`

**متى تحدث:**
بعد إضافة الـ field وتحديد مشروع كـ Roadmap، لكن القيمة ما تتغير.

**ليه تحدث:**
- الـ field أُنشئ كـ `Text` بدل `Yes/No (Boolean)`
- الـ field Internal Name مختلف عما في الكود (`IsRoadmapProject`)

**التحقق:**
```javascript
// شغّله من Browser Console
fetch(`${_spPageContextInfo.siteAbsoluteUrl}/_api/web/lists/getbytitle('PMO_Projects')/fields?$filter=InternalName eq 'IsRoadmapProject'&$select=InternalName,TypeAsString`)
  .then(r=>r.json()).then(d=>console.log(d.value))
// يجب أن يظهر: TypeAsString: "Boolean"
```

إذا `TypeAsString` غير `Boolean`:
1. احذف الـ field من SP
2. أعد إنشاؤه بـ `FieldTypeKind: 8`:
```javascript
// سكريبت إنشاء Yes/No field
const siteUrl = _spPageContextInfo.siteAbsoluteUrl;
const digest = await fetch(`${siteUrl}/_api/contextinfo`,{method:"POST",headers:{"Accept":"application/json;odata=nometadata"}}).then(r=>r.json()).then(d=>d.FormDigestValue);
fetch(`${siteUrl}/_api/web/lists/getbytitle('PMO_Projects')/fields`,{
  method:"POST",
  headers:{"Accept":"application/json;odata=nometadata","Content-Type":"application/json;odata=nometadata","X-RequestDigest":digest},
  body: JSON.stringify({"__metadata":{"type":"SP.Field"},"Title":"IsRoadmapProject","FieldTypeKind":8,"StaticName":"IsRoadmapProject"})
}).then(r=>r.json()).then(d=>console.log(d.error ? "❌ "+d.error.message.value : "✅ Created: "+d.Title))
```

---

### ❌ تاريخ المشروع يظهر بيوم ناقص (off-by-one)

**متى تحدث:**
`startDate` أو `plannedEnd` يظهر بتاريخ أبكر بيوم واحد.

**ليه تحدث:**
SharePoint يحفظ التواريخ كـ UTC. في منطقة AST (Arabia Standard Time = UTC+3) وقت `2026-06-01T00:00:00Z` يصبح `2026-05-31T21:00:00` محلياً.

**الحل:**
الكود يستخدم `safeDate(val)` اللي يعمل `.split("T")[0]` — هذا يأخذ الجزء اليومي من UTC مباشرة ويتجنب المشكلة. إذا الخطأ مستمر:
1. تأكد أن الـ field في SP نوعه `Date Only` (مش `Date & Time`)
2. SP → List Settings → Column → Date and Time Format → Date Only

---

## 4. مشاكل الصلاحيات (RBAC)

---

### ❌ مستخدم يدخل بصلاحية `executive` وهو المفروض `pm` أو `dept_head`

**متى تحدث:**
أول مرة تضيف مستخدم جديد أو بعد تغيير الدور في SP.

**ليه تحدث:**
- المستخدم غير موجود في قائمة `PMO_Users`
- الـ email في `PMO_Users` مختلف عن الـ email الفعلي للمستخدم
- الكود يستخدم `role: "executive"` كـ fallback لأي مستخدم غير معروف

**الحل:**
1. افتح SharePoint → PMO_Users → أضف سجل جديد
2. تأكد أن الـ email في SP **مطابق تماماً** للـ email في Azure AD (حساس للحروف)
3. التحقق من الـ email الفعلي:
```javascript
// في browser console من صفحة البورتال
msalInstance.getActiveAccount()?.username
```

---

### ❌ مدير المشروع (PM) يشوف مشاريع زملائه

**متى تحدث:**
بعد إضافة عدة PMs أو عند تغيير الـ email.

**ليه تحدث:**
الفلتر الخاص بالـ PM يعتمد على `ProjectManagerEmail` في SP. إذا هذا الـ field فارغ في بعض المشاريع، يعتمد على مطابقة الاسم `ProjectManager` وهذا أقل دقة.

**الحل:**
تأكد أن **كل مشروع** لديه `ProjectManagerEmail` مضبوط بشكل صحيح في SP:
```javascript
// تحقق من المشاريع الناقصة الـ email
fetch(`${_spPageContextInfo.siteAbsoluteUrl}/_api/web/lists/getbytitle('PMO_Projects')/items?$select=Title,ProjectManagerEmail&$filter=ProjectManagerEmail eq null`)
  .then(r=>r.json()).then(d=>console.log("Missing email:", d.value.map(i=>i.Title)))
```

---

### ❌ حساب موظف مُقفل (Locked) ومحتاج إعادة تفعيل

**متى تحدث:**
عند تغيير حالة موظف في قائمة `PMO_Users`.

**الحل:**
1. SharePoint → PMO_Users → ابحث عن المستخدم
2. غيّر `IsActive` من `No` إلى `Yes`
3. المستخدم لا يحتاج إعادة تسجيل دخول — التغيير يُطبق في الزيارة التالية

---

### ❌ رئيس القسم (Dept Head) يشوف مشاريع أقسام غيره

**متى تحدث:**
عند تعيين موظف على أكثر من قسم.

**ليه تحدث:**
قائمة `PMO_Users` تدعم عدة أقسام مفصولة بفاصلة في `DepartmentID`:
`"IT,Finance,HR"` — هذا المستخدم يشوف مشاريع الثلاثة أقسام.

**الحل:**
إذا تريد تقييد المستخدم على قسم واحد فقط:
- في SP → PMO_Users → `DepartmentID` = `"IT"` (بدون فاصلة وأقسام إضافية)

---

## 5. مشاكل IPI والحسابات

---

### ❌ IPI يظهر 100 لكل المشاريع

**متى تحدث:**
أول مرة تشغيل البورتال على بيانات حقيقية.

**ليه تحدث:**
إذا `budget = 0` أو `actualCost = 0` فالـ CPI يُحسب كـ `null` ويُستبدل بـ `1.0` (neutral).
إذا `plannedProgress = 0` وما في `startDate`/`plannedEnd` فالـ SPI = `null` ويُستبدل بـ `1.0`.
`1.0 × 0.5 + 1.0 × 0.25 + 1.0 × 0.25 = 1.0 = 100`.

**الحل:**
لكي يكون الـ IPI معبّراً، تأكد أن كل مشروع عنده:
- `budget` و `actualCost` بقيم حقيقية (مش صفر)
- `startDate` و `plannedEnd` محددة
- مستندات مطلوبة (`requiredDocs`) محددة وحالتها معروفة

---

### ❌ IPI يقفز لأرقام غريبة (> 105 أو سالب)

**متى تحدث:**
عند إدخال بيانات غير منطقية (مثلاً: actualCost أكبر جداً من budget).

**ليه تحدث:**
الحد الأقصى للـ IPI هو 105 (`cap: 1.05`). إذا جاء الرقم > 105 معناه `cap` في الكود تجاوز، وهذا يعني بيانات غير منطقية.

**الحل:**
راجع:
- `progress` ≤ 100 دائماً
- `actualCost` ليست أكبر بكثير من `budget` بطريقة غير منطقية
- تواريخ `startDate` < `plannedEnd`

---

### ❌ IPI الـ Department يظهر `—` (null)

**متى تحدث:**
عند إضافة قسم جديد بدون مشاريع.

**ليه تحدث:**
هذا سلوك مقصود: قسم بدون مشاريع يعطي `null` بدل `0`. الـ `0` مضلل (يعني أداء سيء)، بينما `—` يعني "لا يوجد بيانات بعد".

**الحل:** ليس خطأ — الـ `—` صحيح تصميماً. لا تحتاج تغيير.

---

### ❌ IPI تاريخي (Time-weighted) يختلف كثيراً عن الحالي

**متى تحدث:**
بعد فترة من تسجيل Updates للمشاريع.

**ليه تحدث:**
الـ IPI الحالي = snapshot لحظة الاحتساب.
الـ IPI الـ time-weighted = متوسط مرجح بالأيام لكل snapshots في `ipiHistory`.
إذا المشروع كان أداؤه سيئاً لفترة طويلة ثم تحسّن فجأة، المتوسط المرجح سيكون أقل من اللحظي.

**الحل:** ليس خطأ. الـ time-weighted أدق ويعكس الأداء الفعلي على مدار الزمن.

---

## 6. مشاكل الـ Environment Variables

---

### ❌ البورتال يشتغل بـ Mock data رغم `VITE_USE_MOCK=false`

**متى تحدث:**
بعد تعديل `.env` مباشرة بدون إعادة بناء.

**ليه تحدث:**
Vite يُضمّن قيم الـ `VITE_*` في الكود وقت البناء (build time)، مش وقت التشغيل (runtime). التعديل على `.env` يحتاج إعادة بناء.

**الحل:**
```bash
# بعد أي تعديل على .env
npm run build
# أو لـ development
npm run dev   # يقرأ .env تلقائياً عند الإعادة
```

---

### ❌ `undefined` في الـ SP URL — الكود يبني URL غلط

**متى تحدث:**
عند نسيان إضافة `VITE_SP_SITE_URL` في `.env`.

**ليه تحدث:**
المتغير غير موجود → `import.meta.env.VITE_SP_SITE_URL` = `undefined` → URL يصبح `undefined/_api/...`.

**الحل:**
```bash
# تحقق سريع
grep "VITE_SP_SITE_URL" .env
# يجب أن يعطي قيمة مثل:
# VITE_SP_SITE_URL=https://company.sharepoint.com/sites/PMO-2026
```

---

### ❌ `.env` موجود لكن المتغيرات ما تشتغل

**متى تحدث:**
عند وضع `.env` في مجلد خاطئ.

**ليه تحدث:**
Vite يبحث عن `.env` في جذر المشروع (نفس مستوى `package.json`).

**الحل:**
```
pmo-portal-clone/
├── package.json       ← هنا
├── .env               ← لازم يكون هنا، مش في src/
├── src/
│   └── App.jsx
```

---

### ⚠️ تحذير مهم عن الأمان

المتغيرات ذات الـ prefix `VITE_` **تظهر في الكود النهائي** (bundle). هذا يعني:
- ✅ **آمن**: Client ID, Tenant ID, Site URL, List names (هذه ليست أسراراً)
- ❌ **خطر**: لا تضع client secrets أو passwords أو API keys بـ VITE_ prefix

---

## 7. مشاكل البناء والنشر (Build & Deploy)

---

### ❌ `npm run build` يفشل بـ ESLint errors

**متى تحدث:**
بعد تعديل App.jsx أو أي ملف آخر.

**الحل:**
```bash
# شوف الأخطاء بالتفصيل
npm run lint

# الأخطاء الشائعة:
# - unused variable → احذف المتغير أو استخدمه
# - missing dependency in useEffect → أضفه أو أضف eslint-disable-line
```

---

### ❌ تحذير `Some chunks are larger than 500 kB`

**متى تحدث:**
عند كل `npm run build`.

**ليه تحدث:**
App.jsx كبير (~7000 سطر) + Recharts + MSAL. الـ bundle يصل ~1.1MB.

**الحل:**
هذا تحذير وليس خطأ — البناء ينجح. البورتال يُرسل لمستخدمين داخليين على شبكة سريعة. لا تحتاج تغيير الآن.

---

### ❌ الصفحة تعطي 404 بعد النشر على IIS أو Azure Static Web Apps

**متى تحدث:**
عند فتح رابط مباشر أو تحديث الصفحة (Ctrl+F5).

**ليه تحدث:**
البورتال SPA (Single Page App) — كل الـ routes تُدار من JavaScript. الـ server لا يعرف عن `/project/123` لأنه غير موجود كملف حقيقي.

**الحل لـ Azure Static Web Apps:**
أنشئ ملف `staticwebapp.config.json` في جذر المشروع:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*"]
  }
}
```

**الحل لـ IIS:**
أضف `web.config` في مجلد `dist/`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

---

### ❌ CSS لا يظهر بشكل صحيح في production

**متى تحدث:**
البورتال يبدو صحيحاً في `npm run dev` لكن مختلف في `npm run build`.

**ليه تحدث:**
Vite يعيد تسمية CSS files بـ hash. بعض الـ inline styles تعتمد على CSS variables غير معرّفة في production.

**الحل:**
تأكد أن كل الـ styles داخل الكود تستخدم `T.colorName` (theme variables) وليس hardcoded values خارج الـ theme objects.

---

## 8. مشاكل واجهة المستخدم (UI)

---

### ❌ Gantt Chart لا يظهر

**متى تحدث:**
في تاب Milestones لمشروع معين.

**ليه تحدث:**
الـ Gantt يحتاج على الأقل milestone واحد بـ `startDate` أو `date` محدد. إذا كل الـ milestones بدون تواريخ يظهر "No date range available".

**الحل:**
1. افتح الـ Update Panel للمشروع
2. في تاب Milestones أضف تواريخ لكل milestone

---

### ❌ نافذة Print Report لا تفتح

**متى تحدث:**
عند الضغط على زر "Print Report" في GRC Dashboard.

**ليه تحدث:**
المتصفح يحجب الـ `window.open()` إذا لم يُستدعَ مباشرة من حدث click (user gesture).

**الحل:**
1. تأكد من السماح بالـ Popups لهذا الموقع
2. في Chrome: عند ظهور أيقونة الحجب في شريط العنوان → اضغط عليها → Allow
3. في Edge: Settings → Site permissions → Pop-ups and redirects → Add الموقع

---

### ❌ Progress Bar لا يتحرك (ما تظهر الانيميشن)

**متى تحدث:**
عند فتح صفحة بها progress bars.

**ليه تحدث:**
`prefers-reduced-motion: reduce` مفعّل في إعدادات النظام.

**الحل:**
Windows Settings → Ease of Access → Display → Show animations in Windows = On
أو هذا سلوك مقصود لمستخدمي accessibility ولا يحتاج تغيير.

---

### ❌ الـ Theme (Dark/Light) يرجع للـ Default بعد تحديث الصفحة

**متى تحدث:**
عند Ctrl+R أو إعادة فتح البورتال.

**ليه تحدث:**
الـ dark mode state محفوظ في React state فقط، مش في `localStorage`.

**الحل (إضافة persistence):**
هذا تحسين مقترح يمكن إضافته مستقبلاً. حالياً الـ default هو Light mode.

---

## 9. مشاكل لوحة GRC

---

### ❌ لوحة GRC فارغة أو تعطي `Failed to load`

**متى تحدث:**
عند فتح تاب GRC لأول مرة.

**ليه تحدث:**
1. `VITE_GRC_SP_SITE_URL` غير محدد في `.env`
2. الموقع الـ GRC موقع منفصل والمستخدم ليس عضواً فيه
3. الـ access token للـ GRC site غير صالح (scope مختلف)

**الحل:**
```env
# في .env
VITE_GRC_SP_SITE_URL=https://company.sharepoint.com/sites/GRC-Dashboard
```
تأكد أن المستخدم عضو في موقع GRC أيضاً.

---

### ❌ مستخدم بدور `grc` أو `grc_admin` يرى شاشة مختلفة

**ليه:**
هذا مقصود. مستخدمو GRC يرون **فقط** لوحة GRC (بدون sidebar البورتال الرئيسي). `grc_admin` يمكنه التعديل، `grc` للعرض فقط.

**إذا أردت أن يرى GRC user البورتال الكامل أيضاً:**
غير دوره في PMO_Users إلى `executive` أو `pmo_staff`.

---

### ❌ قائمة `GRC_KRIs` / `GRC_RiskRegister` / `GRC_AuditFindings` / `GRC_CorrectiveActions` غير موجودة

**متى تحدث:**
عند إعداد البورتال لأول مرة على موقع GRC جديد.

**ليه تحدث:**
الـ 4 قوائم لازم تُنشأ يدوياً في موقع GRC. ليس لديها template تلقائي.

**أسماء القوائم المطلوبة:**
| Internal Name | الغرض |
|---------------|--------|
| `GRC_KRIs` | مؤشرات المخاطر الرئيسية |
| `GRC_RiskRegister` | سجل المخاطر |
| `GRC_AuditFindings` | نتائج التدقيق |
| `GRC_CorrectiveActions` | الإجراءات التصحيحية |

راجع مستندات إعداد GRC لتفاصيل الـ columns لكل قائمة.

---

## 10. أوامر مفيدة للتشخيص السريع

---

### من Browser Console (DevTools)

```javascript
// 1. تحقق من الـ user المسجّل دخوله
msalInstance?.getActiveAccount()?.username

// 2. تحقق من SP connectivity
const url = import.meta.env?.VITE_SP_SITE_URL;
console.log("SP URL:", url || "NOT SET");

// 3. قائمة كل الـ fields في PMO_Projects
// (شغّله من صفحة SharePoint نفسها)
fetch(`${_spPageContextInfo.siteAbsoluteUrl}/_api/web/lists/getbytitle('PMO_Projects')/fields?$select=InternalName,TypeAsString&$filter=Hidden eq false`)
  .then(r=>r.json()).then(d=>d.value.forEach(f=>console.log(f.InternalName, "|", f.TypeAsString)))

// 4. تحقق من مستخدم معين في PMO_Users
// (شغّله من صفحة SharePoint)
const email = "user@company.com";
fetch(`${_spPageContextInfo.siteAbsoluteUrl}/_api/web/lists/getbytitle('PMO_Users')/items?$filter=Email eq '${email}'&$select=Email,Role,DepartmentID,IsActive`)
  .then(r=>r.json()).then(d=>console.log(d.value))

// 5. عدد المشاريع في SP
fetch(`${_spPageContextInfo.siteAbsoluteUrl}/_api/web/lists/getbytitle('PMO_Projects')/itemcount`)
  .then(r=>r.json()).then(d=>console.log("Total projects:", d.value))
```

---

### من Terminal (في مجلد pmo-portal-clone)

```bash
# بناء وفحص الأخطاء
npm run build

# فحص lint فقط
npm run lint

# تشغيل dev server
npm run dev

# التحقق من .env
type .env | findstr "VITE_"   # Windows CMD
cat .env | grep "VITE_"       # PowerShell / bash

# التحقق من نسخة البناء الأخيرة
git log --oneline -5
```

---

### قائمة تحقق سريعة عند أي مشكلة

```
1. هل VITE_USE_MOCK=false في .env؟
2. هل أعدت npm run build بعد آخر تعديل على .env؟
3. هل المستخدم موجود في PMO_Users وعنده Role محدد؟
4. هل الـ SP site URL صحيح وبدون trailing slash؟
5. هل Azure App Registration عنده Admin Consent؟
6. هل الـ field المشكلة موجود في SP بالنوع الصحيح؟
7. هل Redirect URI في Azure Portal مطابق لـ VITE_AZURE_REDIRECT_URI؟
```

---

*آخر تحديث: 2026-06-13*
