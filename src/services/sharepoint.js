import { MOCK_PROJECTS, MOCK_DEPARTMENTS, MOCK_REQUESTS, MOCK_GATE_SUBMISSIONS, MOCK_CLOSURE_SUBMISSIONS, MOCK_USERS } from "../data/mockData.js";
import { acquireSpToken } from "./auth.js";

// ─── CONFIGURATION ──────────────────────────────────────────────
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export const SP_CONFIG = {
  siteUrl:               import.meta.env.VITE_SP_SITE_URL               || "",
  projectsListName:      import.meta.env.VITE_SP_PROJECTS_LIST          || "PMO_Projects",
  deptsListName:         import.meta.env.VITE_SP_DEPARTMENTS_LIST        || "PMO_Departments",
  requestsListName:      import.meta.env.VITE_SP_REQUESTS_LIST          || "New Project Request",
  gateSubmissionsListName: import.meta.env.VITE_SP_GATE_SUBMISSIONS_LIST || "G1 - Project Initiation",
  closureListName:         import.meta.env.VITE_SP_CLOSURE_LIST          || "Project Closure - E-Signoff",
  usersListName:           import.meta.env.VITE_SP_USERS_LIST            || "PMO_Users",
  pageSize:              Number(import.meta.env.VITE_SP_PAGE_SIZE)       || 500,
};

// ─── FORM URLs ───────────────────────────────────────────────────
// `gate1` points at the Initiation list (workflow Gate 2 in the company's
// 5-stage process). Hardcoded as the source of truth — the env var path
// previously let a stale value on Vercel override the correct URL.
// `intake`, `gate3`, and `closure` still accept env-var overrides for now.
export const FORM_URLS = {
  intake:  import.meta.env.VITE_SP_INTAKE_FORM_URL  || "",
  gate1:   "https://treedigitalinsurance.sharepoint.com/:l:/s/PMO-2026/JAD9joAI4iNJSavgQ9HdBxTrAZJemXJ7Wst3hatKV-zSTI4?nav=YTM2NjgyMDUtMjJiYy00Y2E5LTg4YzEtNjZjZWNkMWYwYjIz",
  gate3:   import.meta.env.VITE_SP_GATE3_FORM_URL   || "",
  closure: import.meta.env.VITE_SP_CLOSURE_FORM_URL || "",
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
  pmEmail:             "ProjectManagerEmail",
  sponsor:             "Sponsor",
  sponsorEmail:        "SponsorEmail",
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
  pmoNotes:            "PMONotes",
  roadmapDeadline:     "RoadmapDeadline",
  isRoadmap:           "IsRoadmapProject",
  actualFinishDate:    "ActualFinishDate",
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
  ipiHistory:          "IPIHistoryJSON",
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

const stripHtml = (str) => str ? String(str).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

// ─── SP ITEM → APP SHAPE ─────────────────────────────────────────
// Converts a raw SharePoint list item to the project shape the UI expects.
// All components read from this normalised shape — SP schema changes only
// require updating SP_FIELD_MAP and this function.
export function mapSPItemToProject(item) {
  const f = SP_FIELD_MAP;
  return {
    // Identity
    id:                  String(item[f.projectId] || item[f.spId] || ""),
    spId:                item[f.spId] || null,
    code:                item[f.code]               || "",
    name:                item[f.name]               || "",
    deptId:              item[f.deptId]             || "",
    projectType:         item[f.projectType]        || "Internal Project",
    // People
    pm:                  item[f.pm]                 || "",
    pmEmail:             item[f.pmEmail]            || "",
    sponsor:             item[f.sponsor]            || "",
    sponsorEmail:        item[f.sponsorEmail]       || "",
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
    pmoNotes:            item[f.pmoNotes]             || "",
    roadmapDeadline:     safeDate(item[f.roadmapDeadline]),
    isRoadmap:           Boolean(item[f.isRoadmap]),
    actualFinishDate:    safeDate(item[f.actualFinishDate]),
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
    ipiHistory:          safeJSON(item[f.ipiHistory],  []),
  };
}

export function mapSPItemToDepartment(item) {
  return {
    spId:  item.ID       || null,
    id:    item.DeptID   || String(item.ID),
    name:  item.Title    || "",
    icon:  item.DeptIcon || "⚡",
    color: item.DeptColor|| "#003932",
  };
}

function buildApprovalHistory(item) {
  const toAction = st => {
    const s = (st || "").toLowerCase();
    if (s.includes("approved")) return "Approved";
    if (s.includes("returned") || s.includes("rejected")) return "Returned";
    return null;
  };
  const history = [];
  const ownerAction = toAction(item.OwnerApprovalStatus);
  if (ownerAction) history.push({
    stage: "Owner / PM Review", action: ownerAction,
    by: item["ProjectOwner_x002f_Manager"]?.Title || "", date: "", notes: ""
  });
  const pmoAction = toAction(item.PMOApprovalStatus);
  if (pmoAction) history.push({
    stage: "PMO Review", action: pmoAction,
    by: "", date: "", notes: item.ReturnNotes || ""
  });
  const strategyAction = toAction(item.StrategyApprovalStatus);
  if (strategyAction) history.push({
    stage: "Strategy Review", action: strategyAction,
    by: "", date: "", notes: ""
  });
  return history;
}

// ─── APP → SP SERIALISER ─────────────────────────────────────────
export function mapProjectToSPItem(project) {
  const f = SP_FIELD_MAP;
  const ns = v => v || null;
  const nn = v => (v !== undefined && v !== null && v !== "") ? Number(v) : null;
  const nd = v => v || null;
  const js = v => Array.isArray(v) ? (v.length ? JSON.stringify(v) : null)
                : (v && typeof v === "object" && Object.keys(v).length ? JSON.stringify(v) : null);
  return {
    [f.projectId]:         project.code             || "",
    [f.code]:              project.code             || "",
    [f.name]:              project.name             || "",
    [f.pm]:                project.pm               || "",
    [f.pmEmail]:           project.pmEmail          || "",
    [f.sponsor]:           project.sponsor          || "",
    [f.sponsorEmail]:      project.sponsorEmail     || "",
    [f.deptId]:            project.deptId           || "",
    [f.projectType]:       project.projectType      || "Internal Project",
    [f.phase]:             project.phase            || "Planning",
    [f.gate]:              project.gate             || "Gate 1",
    [f.status]:            project.status           || "Not Started",
    [f.priority]:          project.priority         || "Medium",
    [f.classification]:    ns(project.classification),
    [f.strategic]:         ns(project.strategic),
    [f.startDate]:         nd(project.startDate),
    [f.plannedEnd]:        nd(project.plannedEnd),
    [f.lastUpdate]:        new Date().toISOString().split("T")[0],
    [f.archivedDate]:      nd(project.archivedDate),
    [f.progress]:          nn(project.progress),
    [f.plannedProgress]:   nn(project.plannedProgress),
    [f.budget]:            nn(project.budget),
    [f.forecast]:          nn(project.forecast),
    [f.actualCost]:        nn(project.actualCost),
    [f.spi]:               nn(project.spi),
    [f.cpi]:               nn(project.cpi),
    [f.daysRemaining]:     nn(project.daysRemaining),
    [f.daysDelayed]:       nn(project.daysDelayed),
    [f.scheduleVariance]:  project.scheduleVariance || "0",
    [f.objective]:         ns(project.objective),
    [f.businessCase]:      ns(project.businessCase),
    [f.riskLevel]:         project.riskLevel        || "Low",
    [f.budgetStatus]:      project.budgetStatus     || "On Budget",
    [f.archived]:          Boolean(project.archived),
    [f.updateCadence]:     project.updateCadence    || "Biweekly",
    [f.nextUpdateDue]:     nd(project.nextUpdateDue),
    [f.lastValidatedUpdate]: nd(project.lastValidatedUpdate),
    [f.dataReliabilityFlag]: project.dataReliabilityFlag || "Pending",
    [f.pmoStatus]:         project.pmoStatus        || "Draft",
    [f.pmoValidationNote]: ns(project.pmoValidationNote),
    [f.pmoValidatedBy]:    ns(project.pmoValidatedBy),
    [f.pmoValidatedDate]:  nd(project.pmoValidatedDate),
    [f.lastSubmittedBy]:   ns(project.lastSubmittedBy),
    [f.lastSubmittedDate]: nd(project.lastSubmittedDate),
    [f.pmoNotes]:          ns(project.pmoNotes),
    [f.roadmapDeadline]:   nd(project.roadmapDeadline),
    [f.isRoadmap]:         Boolean(project.isRoadmap),
    [f.actualFinishDate]:  nd(project.actualFinishDate),
    [f.gates]:             js(project.gates),
    [f.milestones]:        js(project.milestones),
    [f.risks]:             js(project.risks),
    [f.issues]:            js(project.issues),
    [f.benefits]:          js(project.benefits),
    [f.approvals]:         js(project.approvals),
    [f.documents]:         js(project.documents),
    [f.updates]:           js(project.updates),
    [f.health]:            js(project.health),
    [f.requiredDocs]:      js(project.requiredDocs),
    [f.ipiHistory]:        js(project.ipiHistory),
  };
}

// ─── PAGINATION HELPER ───────────────────────────────────────────
// Uses Bearer token (MSAL) — no cookies, works from any origin.
async function fetchAllItems(listName, selectFields = "", expandFields = "", filterQuery = "") {
  const { siteUrl, pageSize } = SP_CONFIG;
  const token = await acquireSpToken();
  const selectParam = selectFields ? `&$select=${selectFields}` : "";
  const expandParam = expandFields ? `&$expand=${expandFields}` : "";
  const filterParam = filterQuery  ? `&$filter=${filterQuery}`  : "";
  const encodedName = encodeURIComponent(listName);
  let url = `${siteUrl}/_api/web/lists/getbytitle('${encodedName}')/items?$top=${pageSize}${selectParam}${expandParam}${filterParam}`;
  const allItems = [];

  while (url) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json;odata=nometadata",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      console.error(`SP fetch failed [${res.status}] ${url}\nResponse body:`, body);
      throw new Error(`SP fetch failed: ${res.status} — ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    allItems.push(...(data.value || []));
    url = data["odata.nextLink"] || null;
  }

  return allItems;
}

// ─── SERVICE OBJECT ──────────────────────────────────────────────
export const SPService = {
  /** Fetch projects, optionally server-side filtered by role.
   *  PM  → only projects where ProjectManagerEmail matches.
   *  Dept Head → only projects in their department.
   *  All other roles → no filter (full list). */
  async getProjects({ role, email, deptId } = {}) {
    if (USE_MOCK) return MOCK_PROJECTS;
    let filterQuery = "";
    if (role === "pm" && email) {
      filterQuery = `ProjectManagerEmail eq '${email.replace(/'/g, "''")}'`;
    } else if (role === "dept_head" && deptId) {
      const isMulti = deptId.includes(",") || deptId.trim().toLowerCase() === "all";
      if (!isMulti) filterQuery = `DepartmentID eq '${deptId.replace(/'/g, "''")}'`;
    }
    const items = await fetchAllItems(SP_CONFIG.projectsListName, "", "", filterQuery);
    return items.map(mapSPItemToProject);
  },

  /** Fetch all departments. */
  async getDepartments() {
    if (USE_MOCK) return MOCK_DEPARTMENTS;
    const items = await fetchAllItems(SP_CONFIG.deptsListName);
    return items.map(mapSPItemToDepartment);
  },

  /** Create a new department. Returns dept object with spId populated. */
  async createDept(dept) {
    if (USE_MOCK) return { ...dept, spId: Date.now() };
    const { siteUrl, deptsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${deptsListName}')/items`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ Title: dept.name, DeptID: dept.id, DeptIcon: dept.icon, DeptColor: dept.color }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`createDept failed: ${res.status} — ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return { ...dept, spId: data.ID };
  },

  /** Update an existing department's metadata fields. */
  async updateDeptSP(spId, data) {
    if (USE_MOCK) return;
    const { siteUrl, deptsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const body = {};
    if (data.name  !== undefined) body.Title    = data.name;
    if (data.icon  !== undefined) body.DeptIcon = data.icon;
    if (data.color !== undefined) body.DeptColor = data.color;
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${deptsListName}')/items(${spId})`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
          "X-HTTP-Method": "MERGE",
          "IF-MATCH": "*",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const b = await res.text().catch(() => "");
      throw new Error(`updateDeptSP failed: ${res.status} — ${b.slice(0, 200)}`);
    }
  },

  /** Delete a department item from SP. */
  async deleteDeptSP(spId) {
    if (USE_MOCK) return;
    const { siteUrl, deptsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${deptsListName}')/items(${spId})`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "IF-MATCH": "*" },
      }
    );
    if (!res.ok && res.status !== 404) {
      const b = await res.text().catch(() => "");
      throw new Error(`deleteDeptSP failed: ${res.status} — ${b.slice(0, 200)}`);
    }
  },

  /** Create a new project in SharePoint. Returns the created project with spId populated. */
  async createProject(project) {
    if (USE_MOCK) return { ...project, spId: Date.now() };
    const { siteUrl, projectsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${projectsListName}')/items`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(mapProjectToSPItem(project)),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SP create failed: ${res.status} — ${body.slice(0, 300)}`);
    }
    return mapSPItemToProject(await res.json());
  },

  /** Update an existing SP item by its numeric SP ID.
   *  omitSPFields: SP column names to exclude from the MERGE payload (e.g. PMO-owned fields). */
  async updateProject(spId, project, omitSPFields = []) {
    if (USE_MOCK) return project;
    const { siteUrl, projectsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const payload = mapProjectToSPItem(project);
    omitSPFields.forEach(f => delete payload[f]);
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${projectsListName}')/items(${spId})`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
          "X-HTTP-Method": "MERGE",
          "IF-MATCH": "*",
        },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SP update failed: ${res.status} — ${body.slice(0, 300)}`);
    }
    return project;
  },

  /** Permanently delete an SP item by its numeric SP ID. */
  async deleteProject(spId) {
    if (USE_MOCK) return;
    const { siteUrl, projectsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${projectsListName}')/items(${spId})`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
          "X-HTTP-Method": "DELETE",
          "IF-MATCH": "*",
        },
      }
    );
    if (!res.ok && res.status !== 204) {
      const body = await res.text().catch(() => "");
      throw new Error(`SP delete failed: ${res.status} — ${body.slice(0, 300)}`);
    }
  },
};

/** True when running against mock data, false when live SP. */
export const isUsingMock = () => USE_MOCK;

// Emails for approval-routing — set via .env so My Actions shows the right person
const PMO_COORDINATOR_EMAIL    = import.meta.env.VITE_PMO_COORDINATOR_EMAIL    || "";
const FINANCE_STAGE1_EMAIL     = import.meta.env.VITE_FINANCE_STAGE1_EMAIL     || "";
const FINANCE_FINAL_EMAIL      = import.meta.env.VITE_FINANCE_FINAL_EMAIL      || "";
const STRATEGY_EMAIL           = import.meta.env.VITE_STRATEGY_EMAIL           || "";

// ─── REQUESTS FIELD MAP ──────────────────────────────────────────
// Maps app field names → actual SharePoint internal column names.
export const SP_REQUESTS_FIELD_MAP = {
  spId:             "ID",
  title:            "Title",
  status:           "OverallStatus",
  pmoStatus:        "PMOApprovalStatus",
  strategyStatus:   "StrategyApprovalStatus",
  ownerStatus:      "OwnerApprovalStatus",
  department:       "Department",
  projectManager:   "ProjectManager",                   // User — expanded
  projectOwner:     "ProjectOwner_x002f_Manager",       // User — expanded
  description:      "ProjectDescription_x002f_Busines",
  newProduct:       "Introducesnewproduct_x003f_",
  newSalesChannel:  "Introducesnewsaleschannel_x003f_",
  enterpriseWide:   "Enterprise_x002d_widesystem_x003",
  regulatory:       "Regulatory_x002f_compliancedrive",
  businessImpact:   "Primarybusinessimpact_x003f_",
  scopeBreadth:     "Scopebreadth",
  beneficiaries:    "Primarybeneficiaries",
  estimatedCost:    "EstimatedTotalCost_x0028_SAR_x00",
  duration:         "ProjectDuration_x0028_Execution_",
  returnNotes:      "ReturnNotes",
  projectCode:      "ProjectCode",
  author:           "Author",                           // User — expanded (created by)
  requestDate:      "Created",
};

// Fields to $select and $expand when querying the requests list.
const REQUESTS_SELECT = [
  "ID","Title","OverallStatus","PMOApprovalStatus","StrategyApprovalStatus","OwnerApprovalStatus",
  "Department",
  "ProjectManager/Title","ProjectManager/EMail",
  "ProjectOwner_x002f_Manager/Title","ProjectOwner_x002f_Manager/EMail",
  "ProjectDescription_x002f_Busines",
  "Introducesnewproduct_x003f_","Introducesnewsaleschannel_x003f_",
  "Enterprise_x002d_widesystem_x003","Regulatory_x002f_compliancedrive",
  "Primarybusinessimpact_x003f_","Scopebreadth","Primarybeneficiaries",
  "EstimatedTotalCost_x0028_SAR_x00","ProjectDuration_x0028_Execution_",
  "ReturnNotes","ProjectCode",
  "Author/Title","Author/EMail",
  "Created",
].join(",");
const REQUESTS_EXPAND = "ProjectManager,ProjectOwner_x002f_Manager,Author";

export function mapSPItemToRequest(item) {
  const f = SP_REQUESTS_FIELD_MAP;
  const ownerEmail = item["ProjectOwner_x002f_Manager"]?.EMail || "";
  const pendingWithEmail = (() => {
    const ownerSt    = (item.OwnerApprovalStatus    || "").toLowerCase();
    const pmoSt      = (item.PMOApprovalStatus      || "").toLowerCase();
    const strategySt = (item.StrategyApprovalStatus || "").toLowerCase();
    if (ownerSt.includes("pending"))    return ownerEmail;
    if (pmoSt.includes("pending"))      return PMO_COORDINATOR_EMAIL;
    if (strategySt.includes("pending")) return STRATEGY_EMAIL;
    return "";
  })();
  return {
    id:              `RQ${item.ID}`,
    spId:            item.ID                       || null,
    title:           item[f.title]                 || "",
    status:          item[f.status]                || "Opened",
    pmoStatus:       item[f.pmoStatus]             || "",
    strategyStatus:  item[f.strategyStatus]        || "",
    ownerStatus:     item[f.ownerStatus]           || "",
    department:      item[f.department]            || "",
    deptId:          item[f.department]            || "",  // alias for existing card UI
    projectManager:  item.ProjectManager?.Title    || "",
    projectOwner:    item["ProjectOwner_x002f_Manager"]?.Title || "",
    pendingWithEmail,
    description:     stripHtml(item[f.description]),
    newProduct:      !!item[f.newProduct],
    newSalesChannel: !!item[f.newSalesChannel],
    enterpriseWide:  !!item[f.enterpriseWide],
    regulatory:      !!item[f.regulatory],
    businessImpact:  item[f.businessImpact]        || "",
    scopeBreadth:    item[f.scopeBreadth]          || "",
    beneficiaries:   item[f.beneficiaries]         || "",
    estimatedCost:   item[f.estimatedCost]         || null,
    duration:        item[f.duration]              || "",
    returnNotes:     item[f.returnNotes]           || "",
    returnReason:    item[f.returnNotes]           || "",  // alias used by RequestCard
    projectCode:     item[f.projectCode]           || "",
    requestedBy:     item.Author?.Title            || "",
    requestedByEmail:item.Author?.EMail            || "",
    requestDate:     safeDate(item[f.requestDate]),
    approvalHistory: buildApprovalHistory(item),
    linkedProjectId: "",
  };
}

// ─── G1 - PROJECT INITIATION FIELD MAP ───────────────────────────
export const SP_GATE_SUBMISSIONS_FIELD_MAP = {
  spId:             "ID",
  title:            "Title",          // project name
  status:           "Status",
  projectManager:   "ProjectManager", // User — expanded
  projectSponsor:   "ProjectSponsor", // User — expanded
  stakeholders:     "Stakeholders",   // Multi-user — expanded
  projectCode:      "ProjectCode",
  financeCapital:   "IsFinanceCapitalizationAssessmen",
  author:           "Author",         // User — expanded (submitted by)
  created:          "Created",
};

const G1_SELECT = [
  "ID","Title","Status","ProjectCode","IsFinanceCapitalizationAssessmen","ApprovalLog",
  "ProjectManager/Title","ProjectManager/EMail",
  "ProjectSponsor/Title","ProjectSponsor/EMail",
  "Stakeholders/Title","Stakeholders/EMail",
  "Author/Title","Author/EMail",
  "Created","Modified",
].join(",");
const G1_EXPAND = "ProjectManager,ProjectSponsor,Stakeholders,Author";

// Extract approver names from a multi-line ApprovalLog string.
// Each line is "{emoji} {Name} (Role) — {Approve|Reject} — {date} — {comment}".
// Returns lower-cased names so we can compare against stakeholder names regardless of case/space.
const extractApproverNames = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  return raw.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\s+[—–-]\s+/);
      if (parts.length < 2) return null;
      const head = parts[0];
      const emojiMatch = head.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|[✅❌⚠️])\s*/u);
      const rest = emojiMatch ? head.slice(emojiMatch[0].length).trim() : head.trim();
      const roleMatch = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      return (roleMatch ? roleMatch[1] : rest).trim();
    })
    .filter(Boolean);
};

// Given the stakeholders array and the ApprovalLog string, return the stakeholders
// who have NOT yet voted (no entry in the log). Each returned item is { title, email }.
// Used to drive the "Pending with: X, Y, Z" display and route the My Actions queue
// only to stakeholders still owing a decision.
const computePendingStakeholders = (stakeholdersRaw, approvalLog) => {
  const voted = new Set(extractApproverNames(approvalLog).map(n => n.toLowerCase()));
  return (stakeholdersRaw || [])
    .filter(u => u && u.Title)
    .map(u => ({ title: u.Title, email: u.EMail || "" }))
    .filter(s => !voted.has(s.title.toLowerCase()));
};

// Derive who the item is currently pending with from its status string.
const pendingWithFromG1Status = (status) => {
  if (!status) return "";
  if (status === "Project Sponsor Review")             return "Project Sponsor";
  if (status === "Stakeholder Review")                 return "Stakeholders";
  if (status === "PMO Review")                         return "PMO";
  if (status === "Finance Review (Stage 1)")           return "Finance — Stage 1";
  if (status === "Finance Review (Final Stage)")       return "Finance — Final";
  if (status === "Approved")                           return "Approved";
  if (status === "Approved - Capitalized Project")     return "Approved — Capitalized";
  if (status === "Approved - Non-Capitalized Project") return "Approved — Non-Capitalized";
  if (status === "Rejected By Project Sponsor")        return "Rejected by Sponsor";
  if (status === "Rejected By Stakeholder")            return "Rejected by Stakeholders";
  if (status === "Rejected By PMO")                    return "Rejected by PMO";
  return status;
};

export function mapSPItemToGateSubmission(item) {
  const submissionDate = safeDate(item.Created);
  const daysAtGate = submissionDate
    ? Math.floor((Date.now() - new Date(item.Created)) / 86400000)
    : 0;
  const st = item.Status || "";
  // Stakeholders who still owe a decision — computed from the ApprovalLog.
  // When status is "Stakeholder Review" this is the routing list; when status
  // is at another stage, the field is still populated for the UI to show
  // upcoming reviewers.
  const pendingStakeholders = computePendingStakeholders(item.Stakeholders, item.ApprovalLog);
  return {
    id:                   `GS${item.ID}`,
    spId:                 item.ID                          || null,
    projectTitle:         item.Title                       || "",
    projectCode:          item.ProjectCode                 || "",
    projectId:            item.ProjectCode                 || "", // matched by code in UI
    gateNumber:           "2",
    gateLabel:            "Gate 2 — Initiation",
    status:               st,
    pendingWith:          pendingWithFromG1Status(st),
    pendingWithEmail:     (() => {
      if (st === "Project Sponsor Review")             return item.ProjectSponsor?.EMail || "";
      if (st === "Stakeholder Review")                 return ""; // multiple emails — routed via pendingStakeholderEmails
      if (st === "PMO Review")                         return PMO_COORDINATOR_EMAIL;
      if (st === "Finance Review (Stage 1)")           return FINANCE_STAGE1_EMAIL;
      if (st === "Finance Review (Final Stage)")       return FINANCE_FINAL_EMAIL;
      return "";
    })(),
    projectManager:       item.ProjectManager?.Title       || "",
    projectSponsor:       item.ProjectSponsor?.Title       || "",
    stakeholders:         (item.Stakeholders || []).map(u => u.Title).filter(Boolean),
    pendingStakeholders:  pendingStakeholders.map(s => s.title),
    pendingStakeholderEmails: pendingStakeholders.map(s => s.email).filter(Boolean),
    financeCapital:       item.IsFinanceCapitalizationAssessmen || "No",
    submittedBy:          item.Author?.Title               || "",
    submittedByEmail:     item.Author?.EMail               || "",
    submissionDate,
    daysAtGate,
    returnReason:         "",
    approvalHistory:      [],
    approvalLog:          item.ApprovalLog                 || "",
  };
}

// ─── EXTENDED SERVICE METHODS ────────────────────────────────────
Object.assign(SPService, {
  /** Fetch all project requests from "New Project Request" list. */
  async getRequests() {
    if (USE_MOCK) return MOCK_REQUESTS;
    try {
      const items = await fetchAllItems(
        SP_CONFIG.requestsListName,
        REQUESTS_SELECT,
        REQUESTS_EXPAND,
      );
      return items.map(mapSPItemToRequest);
    } catch (err) {
      console.warn("getRequests failed (non-fatal):", err.message);
      return [];
    }
  },

  /** Fetch all G1 - Project Initiation submissions. */
  async getGateSubmissions() {
    if (USE_MOCK) return MOCK_GATE_SUBMISSIONS;
    try {
      const items = await fetchAllItems(
        SP_CONFIG.gateSubmissionsListName,
        G1_SELECT,
        G1_EXPAND,
      );
      return items.map(mapSPItemToGateSubmission);
    } catch (err) {
      console.warn("getGateSubmissions failed (non-fatal):", err.message);
      return [];
    }
  },

  /** Fetch all Project Closure - E-Signoff submissions. */
  async getClosureSubmissions() {
    if (USE_MOCK) return MOCK_CLOSURE_SUBMISSIONS;
    try {
      const items = await fetchAllItems(
        SP_CONFIG.closureListName,
        CLOSURE_SELECT,
        CLOSURE_EXPAND,
      );
      return items.map(mapSPItemToClosureSubmission);
    } catch (err) {
      console.warn("getClosureSubmissions failed (non-fatal):", err.message);
      return [];
    }
  },

  /** Look up the current user's role from PMO_Users SP list.
   *  Returns: { role: "pmo_admin"|"pm"|"executive"|"dept_head", deptId: string|null }
   *  Defaults to { role: "executive", deptId: null } on any error or missing record (fail-open). */
  async getUserRole(email) {
    const fallback = { role: "executive", deptId: null };
    if (!email) return fallback;
    if (USE_MOCK) {
      const found = MOCK_USERS.find(u => u.email?.toLowerCase() === email.toLowerCase());
      return found ? { role: found.role || "executive", deptId: found.deptId || null } : fallback;
    }
    try {
      const token = await acquireSpToken();
      const escaped = email.replace(/'/g, "''");
      const url = `${SP_CONFIG.siteUrl}/_api/web/lists/getbytitle('${SP_CONFIG.usersListName}')/items?$select=ID,Title,Role,DeptId,IsActive&$filter=Title eq '${escaped}'&$top=1`;
      const res = await fetch(url, {
        headers: { Accept: "application/json;odata=verbose", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      const items = data?.d?.results || [];
      if (!items.length) return fallback;
      // Deactivated users are fully locked out
      if (items[0].IsActive === false) return { role: "locked", deptId: null };
      const raw = (items[0].Role || "").trim().toLowerCase().replace(/\s+/g, "_");
      const deptId = items[0].DeptId || null;
      if (raw === "pmo_admin")                               return { role: "pmo_admin",  deptId };
      if (raw === "pm")                                      return { role: "pm",          deptId };
      if (raw === "executive")                               return { role: "executive",   deptId };
      if (raw === "dept_head" || raw === "department_head") return { role: "dept_head",   deptId };
      if (raw === "grc")                                     return { role: "grc",         deptId };
      if (raw === "grc_admin")                               return { role: "grc_admin",   deptId };
      if (raw === "pmo_head")                                return { role: "pmo_head",    deptId };
      if (raw === "pmo_staff")                               return { role: "pmo_staff",   deptId };
      return fallback;
    } catch {
      return fallback;
    }
  },

  /** Write PMO validation decision to a project item — only touches PMO-owned fields. */
  async validateUpdate(spId, { approved, note, validatedBy, validatedDate }) {
    if (USE_MOCK) return;
    const { siteUrl, projectsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const payload = approved
      ? { PMOStatus: "Validated", PMOValidatedBy: validatedBy, PMOValidatedDate: validatedDate, PMOValidationNote: null }
      : { PMOStatus: "Returned",  PMOValidationNote: note };
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${projectsListName}')/items(${spId})`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
          "X-HTTP-Method": "MERGE",
          "IF-MATCH": "*",
        },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`validateUpdate failed: ${res.status} — ${body.slice(0, 300)}`);
    }
  },

  /** Write PMO internal notes — only touches PMONotes field, invisible to PM. */
  async savePMONote(spId, note) {
    if (USE_MOCK) return;
    const { siteUrl, projectsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${projectsListName}')/items(${spId})`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
          "X-HTTP-Method": "MERGE",
          "IF-MATCH": "*",
        },
        body: JSON.stringify({ PMONotes: note || null }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`savePMONote failed: ${res.status} — ${body.slice(0, 300)}`);
    }
  },

});

// ─── PROJECT CLOSURE FIELD MAP ───────────────────────────────────
export const SP_CLOSURE_FIELD_MAP = {
  spId:           "ID",
  title:          "Title",
  projectCode:    "ProjectCode",
  department:     "Department",
  status:         "Status",
  stakeholders:   "Stakeholders",
  projectManager: "ProjectManager",
  comments:       "Comments",
  author:         "Author",
  created:        "Created",
};

const CLOSURE_SELECT = [
  "ID","Title","ProjectCode","Department","Status","Comments","ApprovalLog",
  "ProjectManager/Title","ProjectManager/EMail",
  "Stakeholders/Title","Stakeholders/EMail",
  "Author/Title","Author/EMail",
  "Created",
].join(",");
const CLOSURE_EXPAND = "ProjectManager,Stakeholders,Author";

export function mapSPItemToClosureSubmission(item) {
  const submissionDate = safeDate(item.Created);
  const daysInClosure = submissionDate
    ? Math.floor((Date.now() - new Date(item.Created)) / 86400000)
    : 0;
  const st = item.Status || "";
  // Derive who currently holds the closure for review.
  // Workflow: PM submits → PMO first-pass review ("Submitted") → PMO releases
  // for stakeholder review ("In Review") → stakeholders approve → "Closed".
  // pendingStakeholders = stakeholders who still owe a decision (parsed from
  // the ApprovalLog). Drives both the display label and the My Actions queue
  // routing for the "In Review" stage.
  const pendingStakeholders = computePendingStakeholders(item.Stakeholders, item.ApprovalLog);
  const pendingWith = st === "Closed" || st === "Rejected" ? ""
                    : st === "In Review"
                      ? (pendingStakeholders.length > 0 ? pendingStakeholders.map(s => s.title).join(", ") : "Stakeholders")
                      : "PMO";
  const pendingWithEmail = (st === "Closed" || st === "Rejected" || st === "In Review")
    ? "" : PMO_COORDINATOR_EMAIL;
  return {
    id:             `CL${item.ID}`,
    spId:           item.ID                        || null,
    projectTitle:   item.Title                     || "",
    projectCode:    item.ProjectCode               || "",
    projectId:      item.ProjectCode               || "",
    department:     item.Department                || "",
    status:         st,
    projectManager: item.ProjectManager?.Title     || "",
    stakeholders:   (item.Stakeholders || []).map(u => u.Title).filter(Boolean),
    pendingStakeholders:      pendingStakeholders.map(s => s.title),
    pendingStakeholderEmails: pendingStakeholders.map(s => s.email).filter(Boolean),
    comments:       item.Comments                  || "",
    submittedBy:    item.Author?.Title             || "",
    submittedByEmail: item.Author?.EMail           || "",
    submissionDate,
    daysInClosure,
    pendingWith,
    pendingWithEmail,
    approvalLog:    item.ApprovalLog               || "",
  };
}
