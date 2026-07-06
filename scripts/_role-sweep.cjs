// Role-by-role live visibility sweep (mock mode, dev server).
// For each mock user: set the localStorage override, reload, and capture
// what they actually see — landing view, sidebar items, key buttons.
// Gold-standard check per the "cross-screen verification, not code-read"
// rule: we look with eyes, we don't trust the source.

const puppeteer = require("puppeteer");

const ROLES = [
  { email: "admin@pmo.test",        role: "pmo_admin"  },
  { email: "pm.digital@pmo.test",   role: "pm"         },
  { email: "head.digital@pmo.test", role: "dept_head"  },
  { email: "exec@pmo.test",         role: "executive"  },
  { email: "grc@pmo.test",          role: "grc"        },
  { email: "grcadmin@pmo.test",     role: "grc_admin"  },
];

const BASE = "http://localhost:5199/";
const OUT  = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/role-sweep";

(async () => {
  const fs = require("fs");
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });

  const results = [];

  for (const r of ROLES) {
    // Set override BEFORE app boot via evaluateOnNewDocument
    await page.evaluateOnNewDocument((email) => {
      localStorage.setItem("pmo_mock_email", email);
    }, r.email);

    const errors = [];
    const onErr = (e) => errors.push(String(e).slice(0, 200));
    page.on("pageerror", onErr);

    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
    await new Promise(res => setTimeout(res, 2600));

    const snap = await page.evaluate(() => {
      const txt = document.body.innerText;
      const sidebarButtons = [...document.querySelectorAll(".pmo-sidebar button")]
        .map(b => b.textContent.trim().replace(/\d+$/, "").trim())
        .filter(t => t && t.length < 40);
      // Landing heuristic: main heading text
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      return {
        h1,
        sidebar: sidebarButtons.slice(0, 18),
        hasAdminPanel:  txt.includes("Admin Panel"),
        hasWhatIf:      txt.includes("What-If Tools"),
        hasPortfolio:   txt.includes("Portfolio Overview"),
        hasMyProjects:  sidebarButtons.some(t => /My Projects/.test(t)),
        hasAllProjects: sidebarButtons.some(t => /All Projects/.test(t)),
        hasGRC:         txt.includes("GRC") && (txt.includes("KRI") || txt.includes("Risk Indicator")),
        lockout:        txt.includes("Access") && txt.includes("Denied") || txt.includes("locked"),
        bodyLen:        txt.length,
      };
    });

    await page.screenshot({ path: `${OUT}/${r.role}.png` });
    results.push({ ...r, ...snap, errors: errors.slice(0, 2) });
    page.off("pageerror", onErr);
    console.log(`--- ${r.role} (${r.email}) ---`);
    console.log(`  landing h1 : ${snap.h1 || "(none)"}`);
    console.log(`  sidebar    : ${snap.sidebar.join(" | ") || "(none)"}`);
    console.log(`  admin=${snap.hasAdminPanel} whatif=${snap.hasWhatIf} portfolio=${snap.hasPortfolio} myProj=${snap.hasMyProjects} allProj=${snap.hasAllProjects} grc=${snap.hasGRC}`);
    if (errors.length) console.log(`  ⚠ ERRORS: ${errors.join(" ;; ")}`);
  }

  await browser.close();
  console.log("\nScreenshots in:", OUT);
})();
