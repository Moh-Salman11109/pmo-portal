# PMO Portal – Enterprise Governance Dashboard

A production-ready Project Portfolio Management dashboard built with React + Recharts.

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



| Score | Rating |
|-------|--------|
| 85–100 | Excellent 🟢 |
| 70–84 | Good 🟦 |
| 55–69 | Fair 🟡 |
| < 55 | Poor 🔴 |


Test commit from new org setup — 2026-06-30
