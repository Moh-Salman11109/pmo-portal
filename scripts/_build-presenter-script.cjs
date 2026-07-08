// Builds a presenter's script — companion doc to the tech deck.
// A4 portrait. For each slide: what to say (verbatim English),
// Arabic context, expected questions, model answers, escape phrases.
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PMO Portal — Presenter's Script</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --brand: #003932; --mint: #00b894; --mint-lt: #e6f9f5;
    --amber: #f59e0b; --red: #ef4444; --blue: #3b82f6;
    --ink: #0d1f1c; --muted: #4b6c67; --border: #d1e8e4;
    --bg: #f5faf9; --white: #ffffff;
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
    position: relative;
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
    padding: 9px 16mm;
    display: flex; align-items: center; gap: 10px;
  }
  .head .logo { background: var(--mint); color: var(--brand); font-weight: 900; font-size: 11px; padding: 3px 8px; border-radius: 4px; }
  .head .doc { color: rgba(255,255,255,0.6); font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }
  .head .pg { margin-left: auto; color: var(--mint); font-size: 10px; font-weight: 700; }

  .body { flex: 1; padding: 14mm 16mm 14mm; }
  .foot { background: var(--brand); height: 4mm; }

  /* COVER */
  .cover-body {
    background: linear-gradient(135deg, #003932 0%, #005c4b 50%, #007a62 100%);
    color: white;
    padding: 50mm 16mm;
    flex: 1;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; overflow: hidden;
  }
  .cover-body::after {
    content: '';
    position: absolute;
    bottom: -100px; right: -100px;
    width: 350px; height: 350px;
    background: rgba(0,184,148,0.08);
    border-radius: 50%;
  }
  .cover-body .badge {
    display: inline-flex;
    align-items: center; gap: 8px;
    background: rgba(0,184,148,0.18);
    border: 1px solid rgba(0,184,148,0.35);
    border-radius: 22px;
    padding: 6px 16px;
    margin-bottom: 22px;
    align-self: flex-start;
  }
  .cover-body .badge .d { width: 7px; height: 7px; background: var(--mint); border-radius: 50%; }
  .cover-body .badge span { color: var(--mint); font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  .cover-body h1 { color: white; font-size: 44px; font-weight: 900; letter-spacing: -1.2px; line-height: 1.0; margin-bottom: 12px; }
  .cover-body h1 em { color: var(--mint); font-style: normal; }
  .cover-body .lead { color: rgba(255,255,255,0.72); font-size: 16px; font-weight: 400; line-height: 1.5; margin-bottom: 32px; max-width: 80%; }
  .cover-body .meta { display: flex; gap: 32px; }
  .cover-body .meta .item .l { font-size: 10px; color: rgba(0,184,148,0.7); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; }
  .cover-body .meta .item .v { font-size: 13px; color: white; font-weight: 600; }

  /* SECTION HEADERS */
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
    margin-bottom: 8px;
  }
  h2.slide-title {
    font-size: 22px;
    font-weight: 900;
    color: var(--brand);
    letter-spacing: -0.5px;
    line-height: 1.1;
    margin-bottom: 14px;
    border-bottom: 2px solid var(--mint);
    padding-bottom: 8px;
  }
  h2.slide-title .num {
    background: var(--brand);
    color: var(--mint);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 12px;
    margin-right: 10px;
    font-weight: 800;
    vertical-align: middle;
  }

  /* SCRIPT BOX */
  .say {
    background: var(--mint-lt);
    border-left: 4px solid var(--mint);
    border-radius: 0 8px 8px 0;
    padding: 14px 18px;
    margin-bottom: 14px;
  }
  .say .lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--brand);
    margin-bottom: 8px;
  }
  .say p {
    font-size: 13px;
    color: var(--ink);
    line-height: 1.6;
    font-weight: 500;
    font-style: italic;
  }
  .say p + p { margin-top: 8px; }

  .ar {
    background: #fffbeb;
    border-left: 4px solid var(--amber);
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin-bottom: 14px;
    direction: rtl;
    text-align: right;
  }
  .ar .lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.6px;
    color: #92400e;
    margin-bottom: 6px;
    font-family: 'Inter', sans-serif;
  }
  .ar p {
    font-size: 12.5px;
    color: #78350f;
    line-height: 1.7;
    font-family: 'Inter', sans-serif;
  }

  /* Q&A */
  .qa-wrap {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 10px;
  }
  .qa-wrap .qa-head {
    font-size: 10px;
    font-weight: 800;
    color: var(--brand);
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .qa { margin-bottom: 10px; }
  .qa:last-child { margin-bottom: 0; }
  .qa .q {
    font-size: 12px;
    font-weight: 700;
    color: var(--brand);
    margin-bottom: 4px;
  }
  .qa .q::before { content: "❓ "; color: var(--blue); }
  .qa .a {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.55;
    padding-left: 18px;
    border-left: 2px solid var(--mint);
    margin-left: 2px;
  }

  /* TIP / WARN */
  .tip {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .tip .ic { font-size: 16px; flex-shrink: 0; line-height: 1; }
  .tip .t { font-size: 11.5px; color: #1e3a8a; line-height: 1.5; }
  .tip .t strong { color: #1d4ed8; font-weight: 800; }

  /* PHRASES CARD */
  .phrases {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .phrase {
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
  }
  .phrase .when { font-size: 10px; color: var(--mint); font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
  .phrase .text { font-size: 12px; color: var(--brand); font-weight: 600; font-style: italic; line-height: 1.5; }

  /* CHEAT TABLE */
  table.cheat {
    width: 100%; border-collapse: collapse; font-size: 11px;
  }
  table.cheat th {
    background: var(--brand);
    color: white;
    padding: 7px 10px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
  }
  table.cheat th:first-child { border-radius: 6px 0 0 0; }
  table.cheat th:last-child  { border-radius: 0 6px 0 0; }
  table.cheat td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    line-height: 1.4;
  }
  table.cheat tr:nth-child(even) td { background: var(--bg); }
  table.cheat td.k { font-weight: 700; color: var(--brand); }
  table.cheat code {
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--brand);
  }
</style>
</head>
<body>

<!-- ════════════ COVER ════════════ -->
<div class="page">
  <div class="cover-body">
    <div class="badge"><div class="d"></div><span>Presenter's Companion Script</span></div>
    <h1>How to <em>lead</em> the<br>technical handover meeting</h1>
    <div class="lead">A slide-by-slide script — what to say, in English, with Arabic context, anticipated questions, model answers, and safe escape phrases when you don't know something.</div>
    <div class="meta">
      <div class="item"><div class="l">Use with</div><div class="v">PMO-Portal-Tech-Overview.pdf</div></div>
      <div class="item"><div class="l">Audience</div><div class="v">Tree Digital · Technical Team</div></div>
      <div class="item"><div class="l">Style</div><div class="v">Confident · Honest · Concise</div></div>
    </div>
  </div>
</div>

<!-- ════════════ HOW TO USE THIS DOC ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">2</div></div>
  <div class="body">
    <div class="section-tag">Before you start</div>
    <h2 class="slide-title">How to use this script</h2>
    <div class="tip">
      <div class="ic">📘</div>
      <div class="t"><strong>Print both PDFs.</strong> Keep the tech deck on one side, this script on the other. Each section here matches one slide. Glance at the script while the slide is on screen.</div>
    </div>
    <div class="tip">
      <div class="ic">🎙️</div>
      <div class="t"><strong>You don't need to memorise.</strong> Read the script naturally. The phrasing is already meeting-grade English. If something feels awkward, simplify in your own words — the meaning matters, not the wording.</div>
    </div>
    <div class="tip">
      <div class="ic">⏱️</div>
      <div class="t"><strong>Pace yourself.</strong> Each slide should take 2–4 minutes. Total meeting: 45–60 minutes with Q&amp;A. Don't rush; let people interrupt with questions — that's a good sign of engagement.</div>
    </div>
    <div class="tip">
      <div class="ic">🛡️</div>
      <div class="t"><strong>The escape phrases (last page) are your safety net.</strong> Anything you don't know — use them. Saying "let me confirm and come back to you" is far better than guessing in a technical meeting.</div>
    </div>

    <h2 class="slide-title" style="margin-top: 20px;"><span class="num">Pre</span>Opening — first 2 minutes</h2>
    <div class="say">
      <div class="lbl">Say this verbatim</div>
      <p>"Good morning everyone, thanks for taking the time. I have a 15-slide deck that walks through the PMO Portal — what it does, how it's built, what's live in production, and where we need your input before we hand it over formally under the company's name."</p>
      <p>"It should take about 30 minutes, then we'll open up for questions. Feel free to interrupt at any point — I'd rather we discuss as we go than save everything for the end."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق بالعربي</div>
      <p>افتتاحية محايدة وواثقة. الفكرة: تضع التوقعات (30 دقيقة + أسئلة)، تطلب التفاعل، وتذكر صراحة إن في نقاط تحتاج رأيهم. لا تعتذر، لا تقلل من شأن المشروع.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 1 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">3</div></div>
  <div class="body">
    <div class="section-tag">Slide-by-slide script</div>
    <h2 class="slide-title"><span class="num">01</span>Cover — "PMO Portal"</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"This is the PMO Portal — an internal application for Tree Digital Insurance that handles project governance and risk management end to end. It's already live in production, used today by the GRC team and PMO. Today's session is to walk you through how it works technically and discuss what we need from your team to formalise it."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>افتتح بثقة: المشروع موجود، يستخدمه ناس فعليون، الميتنق غرضه "نقل ملكية" مش "بيع فكرة".</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 2 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">4</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">02</span>The Problem — Before / After</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Before the portal, project governance lived in emails, Word checklists, and scattered Excel files. Status calls happened weekly just to compile a portfolio view. KRIs were tracked in separate files per department."</p>
      <p>"After the portal — one place. PMs update their projects directly, the dashboards recompute themselves, approvals are routed by Power Automate with a full audit trail, and the GRC dashboard shows 91 KRIs across 12 departments live."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>هذي شريحة "البيع" — تبرر وجود المشروع. لا تطيل، انتقل بسرعة. النقطة الأساسية: المشروع حل مشكلة حقيقية.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"Was there a previous system you replaced?"</div>
        <div class="a">"No formal system — just SharePoint forms accessed by email links, Word checklists shared in chats, and Excel files emailed around. The portal consolidates those into a single front end."</div>
      </div>
      <div class="qa">
        <div class="q">"Have you measured the time savings?"</div>
        <div class="a">"We haven't run a formal time-savings study, but anecdotally the monthly portfolio review used to take 2–3 days of compilation; now it's live on screen. We can put numbers on it after a quarter of usage."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 3 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">5</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">03</span>At a Glance — the numbers</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Here's where it stands today. About five thousand lines of application code. Twelve departments fully onboarded. Ninety-one Key Risk Indicators tracked, with 372 historical readings already imported covering five quarters of data."</p>
      <p>"Eleven SharePoint Lists serve as the data layer. Nine user roles with role-based access. Six-plus Power Automate flows handle the workflows. And every push to the main branch auto-deploys to production via Vercel."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>أرقام واقعية تثبت إن المشروع جاد ومستخدم فعلاً. لا تتردد في النطق بها بثقة.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"What's the active user count?"</div>
        <div class="a">"Today, primarily the PMO team and the GRC admin. As more departments onboard with the WBS rollout, we expect 20–30 active users initially, scaling with project volume."</div>
      </div>
      <div class="qa">
        <div class="q">"What's the largest SharePoint list — any approaching the 5K item view threshold?"</div>
        <div class="a">"GRC_KRI_Readings is the largest at around 400 items today, and it grows by roughly 90 per quarter. We're years away from the 5K threshold, and even then SharePoint handles indexing on it gracefully."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 4 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">6</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">04</span>Tech Stack — what we picked and why</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"The stack is intentionally boring — proven pieces, fast to ship, easy to maintain at our scale. React 18 with Vite for the UI. MSAL for authentication. SharePoint Online via REST for the data layer. Power Automate for workflows. Vercel for hosting."</p>
      <p>"We deliberately avoided heavier choices like Next.js or Redux because the app is small enough that hooks-based state and a static SPA bundle do the job. Same logic for skipping Tailwind — design tokens and inline styles keep the bundle lean."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>التيم التقني عاده يحب يسأل "ليش هذا مش ذاك". الإجابة الجاهزة: "boring tech" — اخترنا التقنيات الموثوقة المناسبة للحجم، مش الـ trendy.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"Why React and not Next.js or Angular?"</div>
        <div class="a">"This is a client-side SPA — no SSR needed, no SEO concerns, behind Azure AD. React 18 with Vite gives us everything we need with a smaller surface area than Next.js. Angular would have been heavier for a team of one developer to maintain."</div>
      </div>
      <div class="qa">
        <div class="q">"Why no state management library? No Redux or Zustand?"</div>
        <div class="a">"At this scale, useState plus useMemo plus prop drilling are honestly enough. The app has maybe 30 stateful values total. Adding Redux would be over-engineering. If we hit pain points, we can adopt Zustand later — it's a low-cost migration."</div>
      </div>
      <div class="qa">
        <div class="q">"Why no CSS framework like Tailwind?"</div>
        <div class="a">"We use a design tokens object — the theme is a JS object passed via React context. It gives us dark mode for free, brand consistency, and keeps the bundle 100 KB smaller than Tailwind would. Trade-off is verbose inline styles, which we accept."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 5 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">7</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">05</span>Architecture — three Microsoft clouds</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Architecturally — there's no app server. The browser loads a static React bundle from Vercel. From there, it talks to three Microsoft cloud services: Azure AD for identity, SharePoint Online for data, and Power Automate for workflows. No Node server, no managed database, no middleware."</p>
      <p>"Every read and write goes from the browser directly to SharePoint, authorised by a bearer token that MSAL issued. The benefit is operational simplicity — there's nothing for us to run. The trade-off is we lean heavily on Microsoft's SLAs and on client-side validation."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>أهم شريحة معماريا. ركّز عليها 3-4 دقايق. الفكرة: serverless / SaaS-native. التقليل من المخاطر التشغيلية مقابل الاعتماد على مايكروسوفت.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"Is there any caching layer?"</div>
        <div class="a">"No server-side cache — React's component state holds data after fetch. We rely on browser caching for the static assets via Vercel CDN. SharePoint responses are not cached client-side, which is intentional for freshness."</div>
      </div>
      <div class="qa">
        <div class="q">"What happens if SharePoint is down?"</div>
        <div class="a">"The portal degrades gracefully — fetches fail and we show 'unable to load' states. Microsoft's SLA on SharePoint Online is 99.9 percent. We don't have an offline mode; that wasn't a requirement at this scale."</div>
      </div>
      <div class="qa">
        <div class="q">"What about API rate limits from SharePoint?"</div>
        <div class="a">"SP throttles per user per minute. With 30 users and read-heavy traffic, we're nowhere near the limit. We watch for 429 responses but haven't hit any in production."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 6 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">8</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">06</span>Authentication Flow — MSAL</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Authentication is standard OAuth 2.0 via MSAL. When the user opens the portal, MSAL redirects them to login.microsoftonline.com. They sign in with their Tree Digital corporate account plus MFA, just like Outlook or Teams. MSAL then silently acquires a SharePoint-scoped bearer token, and from that point every REST call carries that token."</p>
      <p>"There's also a mock mode for local development that bypasses MSAL entirely — we use it for demos and debugging without hitting the live tenant."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>نقطة مهمة: نفس الـ auth اللي يستخدموه المستخدمين فعلاً (Outlook/Teams). ما عندنا أي حسابات مستقلة. هذا بيريحهم.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"How do you handle token refresh and expiry?"</div>
        <div class="a">"MSAL's acquireTokenSilent handles refresh transparently using its built-in cache. If the cache is invalid, it falls back to acquireTokenRedirect, which prompts the user to re-authenticate. We don't manage tokens manually."</div>
      </div>
      <div class="qa">
        <div class="q">"What scopes does the app request?"</div>
        <div class="a">"AllSites.Write — scoped to the SharePoint resource origin defined in the env var. This gives read and write access to the lists the portal touches, nothing more. No Graph API scopes, no mail, no calendar."</div>
      </div>
      <div class="qa">
        <div class="q">"What happens if the Azure AD app registration is deleted?"</div>
        <div class="a">"The portal would stop authenticating — sign-in would fail. That's why ownership of the AAD app needs to be transferred to a company-managed account as part of the handover, with at least two designated admins."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 7 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">9</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">07</span>Data Layer — SharePoint as backend</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Eleven SharePoint Lists serve as the database. Each list is a table — PMO_Projects, PMO_Departments, the GRC family of lists, the approval intake lists. For sub-collections that don't model cleanly as separate lists — like risks, milestones, and documents within a project — we store them as JSON in a text column on the parent record."</p>
      <p>"Why SharePoint? Because authentication, permissions, versioning, recycle bin, and the REST API are all free with our M365 tenant. The trade-off is that the query language is limited — no joins, OData syntax only — but at 10 to 16 projects a year, we never hit those constraints."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>الموضوع المثير للجدل تقنياً — "ليش SP مش قاعدة بيانات حقيقية؟" الجواب: لأن السكيل يسمح بهذا، وحوافز SP غير ممكنة بسهولة في قاعدة بيانات منفصلة.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"JSON in a text column — that's not queryable. Any concerns?"</div>
        <div class="a">"Correct, it's opaque to SharePoint. We accept that because the queries we run are always 'fetch the whole project record then operate in memory.' If we ever needed cross-project queries on those sub-collections, we'd extract them to dedicated lists."</div>
      </div>
      <div class="qa">
        <div class="q">"Backup and restore strategy?"</div>
        <div class="a">"SharePoint Online has its own backup managed by Microsoft, with version history per item and a 93-day recycle bin. For point-in-time restore beyond that, the IT team can engage Microsoft support. We don't have an additional backup layer — that's something to discuss as part of the DR plan."</div>
      </div>
      <div class="qa">
        <div class="q">"What about the 5,000-item list view threshold?"</div>
        <div class="a">"None of our lists are close. The largest is KRI Readings at around 400. When that grows past a few thousand, we'd add column indexes — SharePoint supports that natively, doesn't require code changes."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 8 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">10</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">08</span>Workflow Automation — Power Automate</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Anything that doesn't belong in the SPA lives in Power Automate. Approval routing is the prime example — when a PM submits a Gate-1 request, a Power Automate flow takes over, routes the approval to sponsor, then stakeholders, then PMO, then Finance, depending on the request fields. Each approver's decision is appended to a text column called ApprovalLog."</p>
      <p>"The portal then reads that column and parses it into a structured audit trail that users see in MyActions and MyRequests. It's a clean separation — workflow logic in Power Automate, presentation in React."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>الـ Power Automate يسوي الـ workflow logic، البورتل يعرضها. نقطة مهمة: هذا Architecture Decision مقصودة، مش "ما عرفنا نسوي".</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"What happens if a flow fails mid-approval?"</div>
        <div class="a">"Power Automate has built-in retry and run history. Failed runs show up in the flow's run history with the error. Today, monitoring relies on the flow owner watching that history — adding alerting on failed runs is on our handover backlog."</div>
      </div>
      <div class="qa">
        <div class="q">"Power Automate licensing — is it covered?"</div>
        <div class="a">"We use standard connectors only — SharePoint, Outlook, Approvals. Those are included in our existing M365 licenses. We don't use premium connectors, so no extra cost. If we wanted Logic Apps later, that would be a separate decision."</div>
      </div>
      <div class="qa">
        <div class="q">"Throttling on the flows?"</div>
        <div class="a">"At our request volume — under 20 flow runs per day — we're well below any throttling limits. Standard SharePoint connector limits are per user per minute, which we'd only approach with hundreds of simultaneous submissions."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 9 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">11</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">09</span>Key Features — what the portal does</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"At the feature level, three pillars. First, the Portfolio Dashboard — KPIs, an executive intervention panel that surfaces projects needing attention, department summary cards, a portfolio timeline. Second, the Project Workspace — five tabs per project: Overview, Activities, Budget, Risks and Issues, Documents and Updates. Third, the GRC Dashboard — 91 KRIs with five quarters of history, multi-filter table, sparklines, and a Risk Register."</p>
      <p>"Cross-cutting features include WBS-style nested Activities, the IPI engine, the ApprovalLog audit trail, and a personal MyActions queue per user."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>عرض سريع. لا تشرح كل ميزة، فقط الثلاث pillars. لو سألوا عن ميزة محددة قول "we can drill into that after."</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"Mobile support?"</div>
        <div class="a">"It works on mobile with responsive layouts via the useBp hook. Charts and tables are usable on tablet. True mobile-first optimization is on the roadmap for the field PMs."</div>
      </div>
      <div class="qa">
        <div class="q">"Offline access?"</div>
        <div class="a">"No offline mode today. The user base is office-based with stable connectivity. PWA capabilities could be added later if field use becomes a requirement."</div>
      </div>
      <div class="qa">
        <div class="q">"Can users export to Excel or PDF?"</div>
        <div class="a">"Yes, we have Excel export on the projects tables and a print-to-PDF flow for the GRC dashboard. The Admin Guide PDF was generated the same way."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 10 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">12</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">10</span>IPI Engine — the regulator-grade metric</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"This is the most scrutinised piece of the portal — the Index of Project Implementation. The regulator audits this. The formula is transparent: Schedule Performance Index weighted 50%, Cost Performance 25%, Document Compliance 25%. The Schedule index is time-based Earned Value Management — at any point in time, planned progress is linearly interpolated between an activity's start and end dates."</p>
      <p>"A roadmap deadline penalty applies one percent per day past the deadline. All components cap at 1.20 so a single outlier can't blow up the index. Every threshold and weight is defined in a single constant called IPI_DEFAULTS — auditable, traceable, change-logged in git."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>هذا الـ make-or-break. اعرض الأرقام بثقة. لو سألوا عن validation rigor، اقول "we're open to a peer review of the formula — the math lives in one file, fully commented."</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"Who validated this formula? Has anyone audited it?"</div>
        <div class="a">"The formula was designed with the PMO Director and aligns with standard EVM practice as used by PMI. It hasn't been externally audited yet — that's part of the road to 2027 license readiness. The code is heavily commented and we welcome a technical review."</div>
      </div>
      <div class="qa">
        <div class="q">"What happens if a project has no plan data?"</div>
        <div class="a">"It returns null and the status reads 'Pending Plan'. Department and portfolio rollups exclude null-IPI projects from the weighted average, so unstarted work doesn't pollute the average. That's intentional."</div>
      </div>
      <div class="qa">
        <div class="q">"Can the PM game the index by setting easy thresholds?"</div>
        <div class="a">"Partially — yes, the PM picks the activity dates and weights in the plan, which means a generous plan would inflate SPI. That's why the roadmap deadline penalty exists — the deadline is set at portfolio level by leadership, not by the PM. Slipping that deadline cuts the index by 1 percent per day."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 11 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">13</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">11</span>Security &amp; DevOps</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Nine user roles enforced at the UI layer and the write layer. Role lookup happens against a PMO_Users SharePoint list at login. The matrix runs from admin with full access down to read-only executive view and a locked-out state."</p>
      <p>"On the write side, we strip PMO-owned fields from any save payload coming from a PM or department head — that's our Step 8 security fix. So a PM submitting an update can never accidentally overwrite a PMO validation note. On the deploy side, push to main triggers a Vercel deploy automatically. Dev branch is the working branch; merge to main only on explicit instruction."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>إذا سألوا عن "is the security tight enough" قول بصراحة: "client-side guards are defence in depth. The real lock is SharePoint item-level permissions, which we configure separately. We'd love your team's review on that."</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"Has the app been penetration tested?"</div>
        <div class="a">"Not yet — that's something we'd want to do before formal handover under the company's name. The attack surface is small because there's no backend, but an external pentest on the AAD config and SP permissions would harden things."</div>
      </div>
      <div class="qa">
        <div class="q">"OWASP Top 10 compliance?"</div>
        <div class="a">"We've addressed the relevant ones — XSS via React's escaping, CSRF isn't applicable because we use bearer tokens not cookies, broken auth is handled by MSAL. SQL injection isn't applicable — no SQL. A formal OWASP review hasn't been done."</div>
      </div>
      <div class="qa">
        <div class="q">"Data residency — where is the data physically?"</div>
        <div class="a">"In Tree Digital's SharePoint Online tenant, which Microsoft hosts in the Saudi or EMEA region depending on the tenant's geo configuration. That's the same as Outlook and Teams data — it stays within the same compliance boundary."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 12 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">14</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">12</span>Roadmap &amp; Open Questions</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Looking forward — the next 90 days I want to ship the Phase 3 simplification, mobile-responsive polish, Power Automate notifications when a KRI breaches its threshold, and a Power BI export for executive monthly reports. An audit log SP list is also on the list for 2027 license readiness."</p>
      <p>"Some things we've consciously deferred — no real-time updates, no cross-list queries, the GRC dashboard could become its own app one day. And there's an IAM migration on the horizon that we'll need to plan for."</p>
      <p>"Then on this side, there are four open questions I'd love your input on — penetration testing depth, the future of GRC as its own app, the MSAL versus generic OIDC choice when IAM migrates, and any concerns about the JSON-in-text-column pattern. We can take these one at a time after the deck."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>اعرض الـ open questions بثقة — أنت تطلب رأيهم، مش تستجدي. أنت اللي بنيت المشروع، هم اللي بيساعدوك تنقله بأمان.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 13 (HEAVY ONE) ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">15</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">13</span>Gap Analysis — the honest one</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"This is the most important slide of the deck. The portal works, it's in production, real users depend on it. But there are honest gaps between 'working' and 'formally handed over under the company's name'. I want us to look at them openly."</p>
      <p>"The four critical items are ownership-related — the GitHub repo, the Vercel hosting, the Power Automate flows, all currently sit under my personal account. And the production bundle still includes a mock-mode bypass that should be stripped before handover. The fourth is testing — we have zero automated tests today."</p>
      <p>"The medium-priority items are operational — no CI pipeline, no staging environment, no monitoring or alerting, no aggregate audit log, and the project has a bus factor of one. The low-priority items are housekeeping — dead fields in the mock data and the lack of a documented disaster recovery plan."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق · مهمة جداً</div>
      <p><strong>أهم شريحة في الميتنق.</strong> اعرضها بصدق وثقة في نفس الوقت. لا تبدو دفاعي. الصراحة هنا تكسب احترام الفريق التقني — هم يعرفون إن المشاريع لها gaps، يقدّرون الـ developer اللي يعترف بها.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions (be prepared)</div>
      <div class="qa">
        <div class="q">"Why no tests from day one?"</div>
        <div class="a">"Speed-to-value. The PMO needed something working fast, so tests were the trade-off. That decision made sense for an MVP — it doesn't make sense for a long-lived production system, which is why testing is on the critical list now."</div>
      </div>
      <div class="qa">
        <div class="q">"You shipped to production without staging?"</div>
        <div class="a">"Yes — Vercel preview branches on git push give us a per-branch URL, which works as informal staging. What we don't have is a formal staging environment with PMO sign-off before main. That's the gap."</div>
      </div>
      <div class="qa">
        <div class="q">"Bus factor of one — that's a serious risk."</div>
        <div class="a">"Absolutely, and I'm flagging it openly. We need either a co-developer for knowledge transfer or a detailed runbook plus onboarding doc so any engineer can pick this up. Both are in the handover plan on the next slide."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 14 ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">16</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">14</span>The 2-3 Week Handover Plan</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"Here's a concrete plan to close those gaps. Eleven tasks, color-coded by priority, with estimated effort. Total is roughly 15 to 18 days of work, spread across IT, DevOps, and developer skill sets — not all on one person."</p>
      <p>"My recommendation is to knock out the four critical items first — that's about five days. Then the four medium-priority items in parallel over the following two weeks. After that, we can sign formal handover with confidence."</p>
      <p>"The alternative is shown at the bottom — hand over today as 'Phase 1 — operational with documented gaps' and treat this table as a backlog the receiving team accepts in writing. Either path works; I just want us to make the call consciously, not by default."</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>الهدف من هذي الشريحة: تحويل القرار من "هل هو جاهز؟" إلى "أي خطة نختار؟" — هذا أقل ضغط عليك وأكثر إنتاجية للنقاش.</p>
    </div>
    <div class="qa-wrap">
      <div class="qa-head">Likely questions</div>
      <div class="qa">
        <div class="q">"Who covers the 15–18 days? Whose budget?"</div>
        <div class="a">"Good question — let's figure that out together. Some tasks are IT-owned (account migration), some are developer-time, some are DevOps. We'd need to split it between teams or carve out time on my side."</div>
      </div>
      <div class="qa">
        <div class="q">"Why can't we just take it as-is today and you keep maintaining it?"</div>
        <div class="a">"We can, as long as the ownership-transfer items are done first — moving the GitHub repo, Vercel hosting, and Power Automate flows to company accounts is non-negotiable. Otherwise the company is dependent on my personal accounts."</div>
      </div>
      <div class="qa">
        <div class="q">"Can your team handle the testing and CI work?"</div>
        <div class="a">"I can write the unit tests around the IPI engine — that's the highest value area. CI pipeline setup is more of a DevOps task; you'd know better whether your team or ours owns that."</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ SLIDE 15 + CLOSING ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">17</div></div>
  <div class="body">
    <h2 class="slide-title"><span class="num">15</span>Closing — wrap-up and Q&amp;A</h2>
    <div class="say">
      <div class="lbl">Say this</div>
      <p>"That's the deck. To recap — the portal is operational, real users rely on it daily, the IPI engine is auditable, and there's a clear plan to close the remaining gaps. The repository URL, the production URL, and the docs are on the screen."</p>
      <p>"I'm open to any questions, technical concerns, or suggestions. What's on your minds?"</p>
    </div>
    <div class="ar">
      <div class="lbl">السياق</div>
      <p>اقفل بهدوء. لا تستعجل. لو فيه صمت بعد سؤالك، انتظر — الناس عادة تحتاج لحظة قبل ما تتكلم. الصمت مش عيب.</p>
    </div>

    <div class="section-tag" style="margin-top: 20px;">During Q&amp;A</div>
    <div class="tip">
      <div class="ic">🎯</div>
      <div class="t"><strong>Repeat the question back.</strong> Helps you process it and confirms you understood. "If I'm getting you right, you're asking about..."</div>
    </div>
    <div class="tip">
      <div class="ic">🛑</div>
      <div class="t"><strong>Don't argue.</strong> If someone disagrees, say "That's a fair point — let's discuss it after the meeting" and move on. The deck is not the place to debate.</div>
    </div>
    <div class="tip">
      <div class="ic">📝</div>
      <div class="t"><strong>Note everything.</strong> Bring a notebook or laptop. Every question you can't answer fully → write it down → send a follow-up email within 24 hours.</div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ ESCAPE PHRASES ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">18</div></div>
  <div class="body">
    <div class="section-tag">Safety net</div>
    <h2 class="slide-title">Escape phrases — when you don't know</h2>
    <div class="tip">
      <div class="ic">🛡️</div>
      <div class="t"><strong>Use these freely.</strong> In a technical meeting, saying "I don't know — I'll get back to you" earns more respect than guessing. Pick whichever feels natural; you can paraphrase.</div>
    </div>
    <div class="phrases">
      <div class="phrase">
        <div class="when">You don't know the answer</div>
        <div class="text">"That's a great question. I don't have the exact number with me — let me confirm and send it over by tomorrow."</div>
      </div>
      <div class="phrase">
        <div class="when">Technical detail beyond your depth</div>
        <div class="text">"I'd want to verify that with the developer before answering — I don't want to give you something I'm not 100% sure of."</div>
      </div>
      <div class="phrase">
        <div class="when">Question about a decision you didn't make</div>
        <div class="text">"That decision predates my involvement on the technical side. Let me check the architecture notes and follow up."</div>
      </div>
      <div class="phrase">
        <div class="when">Someone is going deep on a niche topic</div>
        <div class="text">"Good point. Can we park that for a one-on-one after the meeting? I want to give it the time it deserves."</div>
      </div>
      <div class="phrase">
        <div class="when">Someone disagrees with a design choice</div>
        <div class="text">"I hear you. There were trade-offs and I'd be glad to walk through the reasoning with you offline."</div>
      </div>
      <div class="phrase">
        <div class="when">A question on costs or budget</div>
        <div class="text">"That's a finance question I'd want to coordinate with PMO leadership before answering. Let me come back with the right numbers."</div>
      </div>
      <div class="phrase">
        <div class="when">Question about the regulator's requirements</div>
        <div class="text">"I'll cross-check the regulator's circulars with our Compliance team — I want to give you a precise answer, not my interpretation."</div>
      </div>
      <div class="phrase">
        <div class="when">When you need a moment to think</div>
        <div class="text">"Let me think about that for a second … [pause 3 seconds] … here's how I'd answer that…"</div>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ CHEAT SHEET ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">Presenter's Script</div><div class="pg">19</div></div>
  <div class="body">
    <div class="section-tag">Last page · keep this in front of you</div>
    <h2 class="slide-title">Cheat sheet — the numbers and facts</h2>
    <p style="font-size: 12px; color: var(--muted); margin-bottom: 14px;">If anyone asks for a number, it's probably on this page.</p>
    <table class="cheat">
      <thead><tr><th style="width:40%">Question</th><th>Answer</th></tr></thead>
      <tbody>
        <tr><td class="k">Lines of code</td><td>~5,000 application LOC (excluding scripts and docs)</td></tr>
        <tr><td class="k">Departments tracked</td><td>12 (Compliance, Cyber, Digital, Finance, HR, IT, Marketing, Claims, Customer Care, CX, Procurement, Strategy &amp; PMO)</td></tr>
        <tr><td class="k">KRIs configured</td><td>91 in GRC_KRI_Master</td></tr>
        <tr><td class="k">Historical KRI readings</td><td>372 imported, covering 5 quarters (Q1-2025 → Q1-2026)</td></tr>
        <tr><td class="k">SharePoint Lists</td><td>11 across 2 sites (PMO-2026 + GRC-Dashboard)</td></tr>
        <tr><td class="k">User roles</td><td>9 (admin, pmo_head, pmo_staff, pm, dept_head, executive, grc, grc_admin, locked)</td></tr>
        <tr><td class="k">Power Automate flows</td><td>6+ (intake, approval routing, ApprovalLog updates)</td></tr>
        <tr><td class="k">IPI formula</td><td>0.5·SPI + 0.25·CPI + 0.25·MCI, capped at 1.20 per component</td></tr>
        <tr><td class="k">Roadmap penalty</td><td>−1% SPI per day past the roadmap deadline (decay window 100)</td></tr>
        <tr><td class="k">Max possible IPI</td><td>~115 (when all components hit the cap and MCI is full)</td></tr>
        <tr><td class="k">Production URL</td><td><code>pmo-portal-seven.vercel.app</code></td></tr>
        <tr><td class="k">GitHub repo</td><td><code>github.com/Moh-Salman11109/pmo-portal</code></td></tr>
        <tr><td class="k">Azure AD Client ID</td><td><code>9c40b5ce-b71e-4499-855a-2160bafe708d</code></td></tr>
        <tr><td class="k">Hosting</td><td>Vercel (static SPA, auto-deploy from main branch)</td></tr>
        <tr><td class="k">Auth provider</td><td>Azure AD (Entra ID) via MSAL Browser + MSAL React</td></tr>
        <tr><td class="k">Handover plan effort</td><td>~15–18 days of work, mixed IT/DevOps/Developer</td></tr>
        <tr><td class="k">Critical handover items</td><td>4 (GitHub transfer, Vercel transfer, PA service account, strip mock mode)</td></tr>
      </tbody>
    </table>
    <div class="tip" style="margin-top: 16px;">
      <div class="ic">💪</div>
      <div class="t"><strong>You've got this.</strong> The hardest part of any technical meeting is feeling like you're being interrogated. You're not — you built something useful that's already in production. The team is there to help you make it sustainable. Stay calm, be honest, ask for time when you need it.</div>
    </div>
  </div>
  <div class="foot"></div>
</div>

</body>
</html>`;

const outPath = path.join(__dirname, '..', '..', 'PMO-Portal-Presenter-Script.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath);
console.log('Size:', html.length, 'bytes');
