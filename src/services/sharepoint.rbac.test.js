import { describe, it, expect, vi, beforeEach } from "vitest";

// Force the LIVE path (USE_MOCK = env.VITE_USE_MOCK !== "false") and stub auth.
vi.mock("../config/runtimeEnv.js", () => ({
  env: { VITE_USE_MOCK: "false", VITE_SP_SITE_URL: "https://sp.example.com" },
}));
vi.mock("./auth.js", () => ({ acquireSpToken: vi.fn(async () => "tok") }));

import { SPService } from "./sharepoint.js";

const okJson = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => "" });
const notOk = (status) => ({ ok: false, status, json: async () => ({}), text: async () => `err ${status}` });

beforeEach(() => { global.fetch = vi.fn(); });

// ── P1 · getUserRole fails CLOSED on technical failure ────────────────────
describe("getUserRole — fail-closed on technical failure (P1)", () => {
  it("non-OK response → technical error, NO role granted", async () => {
    global.fetch.mockResolvedValueOnce(notOk(500));
    const r = await SPService.getUserRole("a@x.com");
    expect(r.error).toBe("technical");
    expect(r.role).toBeNull();
  });

  it("thrown/network error → technical error, NO role granted", async () => {
    global.fetch.mockRejectedValueOnce(new Error("network down"));
    const r = await SPService.getUserRole("a@x.com");
    expect(r.error).toBe("technical");
    expect(r.role).toBeNull();
  });

  it("genuine unregistered user (empty result) → executive (business default)", async () => {
    global.fetch.mockResolvedValueOnce(okJson({ d: { results: [] } }));
    const r = await SPService.getUserRole("a@x.com");
    expect(r).toEqual({ role: "executive", deptId: null });
  });

  it("deactivated user (IsActive false) → locked", async () => {
    global.fetch.mockResolvedValueOnce(okJson({ d: { results: [{ Role: "pm", IsActive: false }] } }));
    const r = await SPService.getUserRole("a@x.com");
    expect(r.role).toBe("locked");
  });

  it("known role → that role", async () => {
    global.fetch.mockResolvedValueOnce(okJson({ d: { results: [{ Role: "pm", DeptId: "hr", IsActive: true }] } }));
    const r = await SPService.getUserRole("a@x.com");
    expect(r).toEqual({ role: "pm", deptId: "hr" });
  });

  it("unrecognised role string → locked (fail-closed, not a broad view)", async () => {
    global.fetch.mockResolvedValueOnce(okJson({ d: { results: [{ Role: "superuser", IsActive: true }] } }));
    const r = await SPService.getUserRole("a@x.com");
    expect(r.role).toBe("locked");
  });
});

// ── P4 · getProjects never widens to all on a missing identity ────────────
describe("getProjects — filters fail closed (P4)", () => {
  const lastUrl = () => global.fetch.mock.calls[global.fetch.mock.calls.length - 1][0];

  it("PM with no email → [] and NO fetch (never all)", async () => {
    const r = await SPService.getProjects({ role: "pm", email: "" });
    expect(r).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("Dept-Head with no deptId → [] and NO fetch (never all)", async () => {
    const r = await SPService.getProjects({ role: "dept_head", deptId: "" });
    expect(r).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("PM with email → server-side substringof filter", async () => {
    global.fetch.mockResolvedValueOnce(okJson({ value: [] }));
    await SPService.getProjects({ role: "pm", email: "pm@x.com" });
    expect(decodeURIComponent(lastUrl())).toContain("substringof('pm@x.com', ProjectManagerEmail)");
  });

  it("Dept-Head multi-dept → server-side OR filter (not all)", async () => {
    global.fetch.mockResolvedValueOnce(okJson({ value: [] }));
    await SPService.getProjects({ role: "dept_head", deptId: "hr, it" });
    const u = decodeURIComponent(lastUrl());
    expect(u).toContain("DepartmentID eq 'hr' or DepartmentID eq 'it'");
  });

  it("Dept-Head 'all' → authorized enterprise-wide (no dept filter)", async () => {
    global.fetch.mockResolvedValueOnce(okJson({ value: [] }));
    await SPService.getProjects({ role: "dept_head", deptId: "all" });
    const u = decodeURIComponent(lastUrl());
    expect(u).not.toContain("DepartmentID eq");
  });
});
