# PMO Portal – Enterprise Governance Dashboard

A production-ready Project Portfolio Management dashboard built with React + Recharts.

## 🚀 Quick Deploy (GitHub Pages – Free Hosting)

### Step 1 – Upload to GitHub
1. Go to [github.com/new](https://github.com/new)
2. Create a new **public** repository named `pmo-portal`
3. Upload all these files (drag & drop the folder)

### Step 2 – Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Under **Source** select: `GitHub Actions`
3. Save

### Step 3 – Trigger Deploy
Push to `main` branch — the workflow runs automatically.
Your live URL will be:
```
https://YOUR-USERNAME.github.io/pmo-portal/
```

---

## 💻 Run Locally

```bash
npm install
npm run dev
```
Open: http://localhost:5173

---

## 🏗️ Build for Production

```bash
npm run build
# Output in /dist folder
```

---

## 📁 Project Structure

```
pmo-portal/
├── src/
│   ├── App.jsx        ← Main dashboard (all views + data)
│   └── main.jsx       ← React entry point
├── index.html
├── vite.config.js
├── package.json
└── .github/
    └── workflows/
        └── deploy.yml ← Auto-deploy to GitHub Pages
```

---

## 🔌 SharePoint Integration (Future)

When ready to connect real data, replace the `SPService` object in `App.jsx`:

```js
// Current (mock):
const SPService = {
  getProjects: async (mockProjects) => mockProjects,
};

// Future (SharePoint Graph API):
const SPService = {
  getProjects: async () => {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/{SITE_ID}/lists/Projects/items?$expand=fields`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.value.map(item => item.fields);
  },
};
```

SharePoint Lists needed:
- `Projects` — main project records
- `Project_Milestones` — linked by ProjectId
- `Project_Risks` — linked by ProjectId
- `Project_Issues` — linked by ProjectId
- `Project_Documents` — linked by ProjectId
- `Project_Updates` — linked by ProjectId
- `Project_Benefits` — linked by ProjectId
- `Project_Approvals` — linked by ProjectId

---

## 🧮 IPI Formula

**Project IPI** = `SPI × 50%` + `CPI × 25%` + `Docs Compliance × 25%`

**Department IPI** = Average of all project IPIs in the department

**Portfolio IPI** = Average of all department IPIs

| Score | Rating |
|-------|--------|
| 85–100 | Excellent 🟢 |
| 70–84 | Good 🟦 |
| 55–69 | Fair 🟡 |
| < 55 | Poor 🔴 |
