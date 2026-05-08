import { MOCK_PROJECTS, MOCK_DEPARTMENTS } from "../data/mockData.js";

// ─── CONFIGURATION ───────────────────────────────────────────────
// Set VITE_USE_MOCK=false in .env to connect to SharePoint.
// Set VITE_SP_SITE_URL to your SharePoint site URL.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export const SP_CONFIG = {
  siteUrl:          import.meta.env.VITE_SP_SITE_URL          || "",
  projectsListName: import.meta.env.VITE_SP_PROJECTS_LIST     || "PMO_Projects",
  deptsListName:    import.meta.env.VITE_SP_DEPARTMENTS_LIST   || "PMO_Departments",
  pageSize:         Number(import.meta.env.VITE_SP_PAGE_SIZE)  || 500,
};

// ─── FIELD MAP ───────────────────────────────────────────────────
// Left = app field name. Right = SharePoint column internal name.
// Only this map needs updating when SP schema changes.
export const SP_FIELD_MAP = {
  spId:                "ID",
  projectId:           "ProjectID",
  code:                "ProjectCode",
  name:                "Title",
  pm:                  "ProjectManager",
  sponsor:             "Sponsor",
  deptId:              "DepartmentID",
  projectType:         "ProjectType",
  phase:               "Phase",
  gate:                "CurrentGate",
  status:              "Status",
  priority:            "Priority",
  classification:      "Classification",
  strategic:           "StrategicObjective",
  startDate:           "StartDate",
  plannedEnd:          "PlannedEndDate",
  lastUpdate:          "LastUpdate",
  archivedDate:        "ArchivedDate",
  progress:            "Progress",
  plannedProgress:     "PlannedProgress",
  budget:              "Budget",
  forecast:            "Forecast",
  actualCost:          "ActualCost",
  spi:                 "SPI",
  cpi:                 "CPI",
  daysRemaining:       "DaysRemaining",
  daysDelayed:         "DaysDelayed",
  scheduleVariance:    "ScheduleVariance",
  objective:           "Objective",
  businessCase:        "BusinessCase",
  budgetStatus:        "BudgetStatus",
  riskLevel:           "RiskLevel",
  archived:            "IsArchived",
  updateCadence:       "UpdateCadence",
  nextUpdateDue:       "NextUpdateDue",
  lastValidatedUpdate: "LastValidatedUpdate",
  dataReliabilityFlag: "DataReliabilityFlag",
  // PMO Validation Layer — SP column names configurable here, no UI changes needed
  pmoStatus:           "PMOStatus",
  pmoValidationNote:   "PMOValidationNote",
  pmoValidatedBy:      "PMOValidatedBy",
  pmoValidatedDate:    "PMOValidatedDate",
  lastSubmittedBy:     "LastSubmittedBy",
  lastSubmittedDate:   "LastSubmittedDate",
  // JSON columns — stored as multi-line text in SP, parsed with safeJSON()
  gates:               "GatesJSON",
  milestones:          "MilestonesJSON",
  risks:               "RisksJSON",
  issues:              "IssuesJSON",
  benefits:            "BenefitsJSON",
  approvals:           "ApprovalsJSON",
  documents:           "DocumentsJSON",
  updates:             "UpdatesJSON",
  health:              "HealthJSON",
  requiredDocs:        "RequiredDocsJSON",
};

// ─── HELPERS ─────────────────────────────────────────────────────
const safeJSON = (str, fallback = null) => {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
};

const safeNum = (val, fallback = 0) => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

const safeDate = (val) => (val ? String(val).split("T")[0] : null);

// ─── SP ITEM → APP SHAPE ─────────────────────────────────────────
// Converts a raw SharePoint list item to the project shape the UI expects.
// All components read from this normalised shape — SP schema changes only
// require updating SP_FIELD_MAP and this function.
export function mapSPItemToProject(item) {
  const f = SP_FIELD_MAP;
  return {
    // Identity
    id:                  String(item[f.projectId] || item[f.spId] || ""),
    code:                item[f.code]               || "",
    name:                item[f.name]               || "",
    deptId:              item[f.deptId]             || "",
    projectType:         item[f.projectType]        || "Internal Project",
    // People
    pm:                  item[f.pm]                 || "",
    sponsor:             item[f.sponsor]            || "",
    // Classification
    phase:               item[f.phase]              || "",
    gate:                item[f.gate]               || "",
    status:              item[f.status]             || "Not Started",
    priority:            item[f.priority]           || "Medium",
    classification:      item[f.classification]     || "",
    strategic:           item[f.strategic]          || "",
    riskLevel:           item[f.riskLevel]          || "Low",
    budgetStatus:        item[f.budgetStatus]       || "On Budget",
    // Dates
    startDate:           safeDate(item[f.startDate]),
    plannedEnd:          safeDate(item[f.plannedEnd]),
    lastUpdate:          safeDate(item[f.lastUpdate]),
    archivedDate:        safeDate(item[f.archivedDate]),
    // Progress & financials
    progress:            safeNum(item[f.progress]),
    plannedProgress:     safeNum(item[f.plannedProgress]),
    budget:              safeNum(item[f.budget]),
    forecast:            safeNum(item[f.forecast]),
    actualCost:          safeNum(item[f.actualCost]),
    spi:                 safeNum(item[f.spi], 1),
    cpi:                 safeNum(item[f.cpi], 1),
    daysRemaining:       safeNum(item[f.daysRemaining]),
    daysDelayed:         safeNum(item[f.daysDelayed]),
    scheduleVariance:    item[f.scheduleVariance]   || "0",
    // Narrative
    objective:           item[f.objective]          || "",
    businessCase:        item[f.businessCase]       || "",
    // Lifecycle
    archived:            Boolean(item[f.archived]),
    updateCadence:       item[f.updateCadence]        || "Biweekly",
    nextUpdateDue:       safeDate(item[f.nextUpdateDue]),
    lastValidatedUpdate: safeDate(item[f.lastValidatedUpdate]),
    dataReliabilityFlag: item[f.dataReliabilityFlag]  || "Pending",
    // PMO Validation Layer
    pmoStatus:           item[f.pmoStatus]            || "Draft",
    pmoValidationNote:   item[f.pmoValidationNote]    || "",
    pmoValidatedBy:      item[f.pmoValidatedBy]       || "",
    pmoValidatedDate:    safeDate(item[f.pmoValidatedDate]),
    lastSubmittedBy:     item[f.lastSubmittedBy]      || "",
    lastSubmittedDate:   safeDate(item[f.lastSubmittedDate]),
    // JSON sub-objects
    gates:               safeJSON(item[f.gates],       []),
    milestones:          safeJSON(item[f.milestones],  []),
    risks:               safeJSON(item[f.risks],       []),
    issues:              safeJSON(item[f.issues],      []),
    benefits:            safeJSON(item[f.benefits],    []),
    approvals:           safeJSON(item[f.approvals],   []),
    documents:           safeJSON(item[f.documents],   []),
    updates:             safeJSON(item[f.updates],     []),
    health:              safeJSON(item[f.health],      {}),
    requiredDocs:        safeJSON(item[f.requiredDocs],[]),
  };
}

export function mapSPItemToDepartment(item) {
  return {
    id:    item.DeptID   || String(item.ID),
    name:  item.Title    || "",
    icon:  item.DeptIcon || "⚡",
    color: item.DeptColor|| "#003932",
  };
}

// ─── PAGINATION HELPER ───────────────────────────────────────────
async function fetchAllItems(listName, selectFields = "") {
  const { siteUrl, pageSize } = SP_CONFIG;
  const selectParam = selectFields ? `&$select=${selectFields}` : "";
  let url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items?$top=${pageSize}${selectParam}`;
  const allItems = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Accept: "application/json;odata=nometadata" },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`SP fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    allItems.push(...(data.value || []));
    // SharePoint pagination: follow odata.nextLink
    url = data["odata.nextLink"] || null;
  }

  return allItems;
}

// ─── SERVICE OBJECT ──────────────────────────────────────────────
export const SPService = {
  /** Fetch all active projects. Returns app-shaped objects. */
  async getProjects() {
    if (USE_MOCK) return MOCK_PROJECTS;
    const items = await fetchAllItems(SP_CONFIG.projectsListName);
    return items.map(mapSPItemToProject);
  },

  /** Fetch all departments. */
  async getDepartments() {
    if (USE_MOCK) return MOCK_DEPARTMENTS;
    const items = await fetchAllItems(SP_CONFIG.deptsListName);
    return items.map(mapSPItemToDepartment);
  },

  /** Save (create or update) a project. Stub — implement in Phase 2B. */
  async saveProject(project) {
    if (USE_MOCK) return project;
    // Phase 2B: POST/PATCH to SP list with JSON columns serialised
    console.warn("SPService.saveProject: not yet connected to SharePoint");
    return project;
  },

  /** Archive a project by setting IsArchived = true. Stub — implement in Phase 2B. */
  async archiveProject(id) {
    if (USE_MOCK) return id;
    console.warn("SPService.archiveProject: not yet connected to SharePoint");
    return id;
  },
};

/** True when running against mock data, false when live SP. */
export const isUsingMock = () => USE_MOCK;
