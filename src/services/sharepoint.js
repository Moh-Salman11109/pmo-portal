import { MOCK_PROJECTS, MOCK_DEPARTMENTS, MOCK_REQUESTS, MOCK_GATE_SUBMISSIONS } from "../data/mockData.js";
import { acquireSpToken } from "./auth.js";

// ─── CONFIGURATION ───────────────────────────────────────────────
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export const SP_CONFIG = {
  siteUrl:               import.meta.env.VITE_SP_SITE_URL               || "",
  projectsListName:      import.meta.env.VITE_SP_PROJECTS_LIST          || "PMO_Projects",
  deptsListName:         import.meta.env.VITE_SP_DEPARTMENTS_LIST        || "PMO_Departments",
  requestsListName:      import.meta.env.VITE_SP_REQUESTS_LIST          || "PMO_Requests",
  gateSubmissionsListName: import.meta.env.VITE_SP_GATE_SUBMISSIONS_LIST || "PMO_GateSubmissions",
  pageSize:              Number(import.meta.env.VITE_SP_PAGE_SIZE)       || 500,
};

// ─── FORM URLs ───────────────────────────────────────────────────
export const FORM_URLS = {
  intake:  import.meta.env.VITE_SP_INTAKE_FORM_URL  || "",
  gate1:   import.meta.env.VITE_SP_GATE1_FORM_URL   || "",
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
    spId:                item[f.spId] || null,
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
    [f.sponsor]:           project.sponsor          || "",
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
  };
}

// ─── PAGINATION HELPER ───────────────────────────────────────────
// Uses Bearer token (MSAL) — no cookies, works from any origin.
async function fetchAllItems(listName, selectFields = "") {
  const { siteUrl, pageSize } = SP_CONFIG;
  const token = await acquireSpToken();
  const selectParam = selectFields ? `&$select=${selectFields}` : "";
  let url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items?$top=${pageSize}${selectParam}`;
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

  /** Update an existing SP item by its numeric SP ID. */
  async updateProject(spId, project) {
    if (USE_MOCK) return project;
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
        body: JSON.stringify(mapProjectToSPItem(project)),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SP update failed: ${res.status} — ${body.slice(0, 300)}`);
    }
    return project;
  },
};

/** True when running against mock data, false when live SP. */
export const isUsingMock = () => USE_MOCK;

// ─── REQUESTS FIELD MAP ──────────────────────────────────────────
export const SP_REQUESTS_FIELD_MAP = {
  spId:                  "ID",
  title:                 "Title",
  requestedBy:           "RequestedBy",
  requestedByEmail:      "RequestedByEmail",
  requestDate:           "RequestDate",
  description:           "Description",
  deptId:                "DepartmentID",
  proposedPm:            "ProposedPM",
  proposedSponsor:       "ProposedSponsor",
  status:                "Status",
  currentStage:          "CurrentStage",
  pendingWith:           "PendingWith",
  pendingWithEmail:      "PendingWithEmail",
  lastActionDate:        "LastActionDate",
  daysInCurrentStage:    "DaysInCurrentStage",
  returnReason:          "ReturnReason",
  rejectionReason:       "RejectionReason",
  approvalHistory:       "ApprovalHistoryJSON",
  linkedProjectId:       "LinkedProjectID",
};

export function mapSPItemToRequest(item) {
  const f = SP_REQUESTS_FIELD_MAP;
  return {
    id:                 `RQ${item[f.spId]}`,
    spId:               item[f.spId]             || null,
    title:              item[f.title]             || "",
    requestedBy:        item[f.requestedBy]       || "",
    requestedByEmail:   item[f.requestedByEmail]  || "",
    requestDate:        safeDate(item[f.requestDate]),
    description:        item[f.description]       || "",
    deptId:             item[f.deptId]            || "",
    proposedPm:         item[f.proposedPm]        || "",
    proposedSponsor:    item[f.proposedSponsor]   || "",
    status:             item[f.status]            || "Draft",
    currentStage:       item[f.currentStage]      || "",
    pendingWith:        item[f.pendingWith]        || "",
    pendingWithEmail:   item[f.pendingWithEmail]   || "",
    lastActionDate:     safeDate(item[f.lastActionDate]),
    daysInCurrentStage: safeNum(item[f.daysInCurrentStage]),
    returnReason:       item[f.returnReason]       || "",
    rejectionReason:    item[f.rejectionReason]    || "",
    approvalHistory:    safeJSON(item[f.approvalHistory], []),
    linkedProjectId:    item[f.linkedProjectId]    || "",
  };
}

// ─── GATE SUBMISSIONS FIELD MAP ──────────────────────────────────
export const SP_GATE_SUBMISSIONS_FIELD_MAP = {
  spId:                  "ID",
  projectId:             "ProjectID",
  projectTitle:          "ProjectTitle",
  gateNumber:            "GateNumber",
  gateLabel:             "GateLabel",
  submittedBy:           "SubmittedBy",
  submittedByEmail:      "SubmittedByEmail",
  submissionDate:        "SubmissionDate",
  status:                "Status",
  currentStage:          "CurrentStage",
  pendingWith:           "PendingWith",
  pendingWithEmail:      "PendingWithEmail",
  lastActionDate:        "LastActionDate",
  daysAtGate:            "DaysAtGate",
  returnReason:          "ReturnReason",
  financeClassification: "FinanceClassification",
  approvalHistory:       "ApprovalHistoryJSON",
  documentsJSON:         "DocumentsJSON",
};

export function mapSPItemToGateSubmission(item) {
  const f = SP_GATE_SUBMISSIONS_FIELD_MAP;
  return {
    id:                  `GS${item[f.spId]}`,
    spId:                item[f.spId]                || null,
    projectId:           item[f.projectId]           || "",
    projectTitle:        item[f.projectTitle]        || "",
    gateNumber:          item[f.gateNumber]          || "",
    gateLabel:           item[f.gateLabel]           || "",
    submittedBy:         item[f.submittedBy]         || "",
    submittedByEmail:    item[f.submittedByEmail]    || "",
    submissionDate:      safeDate(item[f.submissionDate]),
    status:              item[f.status]              || "Submitted",
    currentStage:        item[f.currentStage]        || "",
    pendingWith:         item[f.pendingWith]         || "",
    pendingWithEmail:    item[f.pendingWithEmail]    || "",
    lastActionDate:      safeDate(item[f.lastActionDate]),
    daysAtGate:          safeNum(item[f.daysAtGate]),
    returnReason:        item[f.returnReason]        || "",
    financeClassification: item[f.financeClassification] || "",
    approvalHistory:     safeJSON(item[f.approvalHistory], []),
    documentsJSON:       safeJSON(item[f.documentsJSON],  []),
  };
}

// ─── EXTENDED SERVICE METHODS ────────────────────────────────────
Object.assign(SPService, {
  /** Fetch all project requests. */
  async getRequests() {
    if (USE_MOCK) return MOCK_REQUESTS;
    try {
      const items = await fetchAllItems(SP_CONFIG.requestsListName);
      return items.map(mapSPItemToRequest);
    } catch (err) {
      // List does not exist yet — return empty until IT creates it
      if (err.message?.includes("404")) return [];
      throw err;
    }
  },

  /** Fetch all gate submissions. */
  async getGateSubmissions() {
    if (USE_MOCK) return MOCK_GATE_SUBMISSIONS;
    try {
      const items = await fetchAllItems(SP_CONFIG.gateSubmissionsListName);
      return items.map(mapSPItemToGateSubmission);
    } catch (err) {
      // List does not exist yet — return empty until IT creates it
      if (err.message?.includes("404")) return [];
      throw err;
    }
  },

  /** Create a new request record (Draft — before opening SP form). */
  async createRequest(request) {
    if (USE_MOCK) return { ...request, spId: Date.now() };
    const { siteUrl, requestsListName } = SP_CONFIG;
    const token = await acquireSpToken();
    const f = SP_REQUESTS_FIELD_MAP;
    const body = {
      [f.title]:          request.title       || "",
      [f.requestedBy]:    request.requestedBy || "",
      [f.requestedByEmail]: request.requestedByEmail || "",
      [f.description]:    request.description || "",
      [f.deptId]:         request.deptId      || "",
      [f.proposedPm]:     request.proposedPm  || "",
      [f.proposedSponsor]:request.proposedSponsor || "",
      [f.status]:         "Draft",
      [f.requestDate]:    new Date().toISOString().split("T")[0],
    };
    const res = await fetch(
      `${siteUrl}/_api/web/lists/getbytitle('${requestsListName}')/items`,
      {
        method: "POST",
        headers: {
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SP create request failed: ${res.status} — ${text.slice(0, 300)}`);
    }
    return mapSPItemToRequest(await res.json());
  },
});
