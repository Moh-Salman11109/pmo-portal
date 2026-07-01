import { useMsal } from "@azure/msal-react";
import { env } from "../config/runtimeEnv.js";

const USE_MOCK = env.VITE_USE_MOCK !== "false";

// Defence-in-depth: the localStorage override is a developer convenience for
// flipping roles during local testing. It must NEVER influence a production
// build — that would let any user assume any role just by editing browser
// storage. Vite sets MODE = "development" only for `vite dev`; both
// `vite build` and `vite preview` set MODE = "production".
const ALLOW_LOCAL_OVERRIDE =
  USE_MOCK && import.meta.env.MODE === "development";

// In mock mode no MSAL provider is mounted, so useMsal() returns empty state.
// We inject a fake identity from localStorage (dev only) or the VITE_MOCK_EMAIL
// env var, falling back to the PMO admin test account.
//
// To switch roles during local dev (no effect in production builds):
//   localStorage.setItem('pmo_mock_email', 'pm.strategy@pmo.test'); location.reload();
//   localStorage.removeItem('pmo_mock_email');  // back to default
const MOCK_EMAIL = (ALLOW_LOCAL_OVERRIDE && typeof localStorage !== "undefined"
  ? localStorage.getItem("pmo_mock_email")
  : null)
  || env.VITE_MOCK_EMAIL
  || "admin@pmo.test";

const MOCK_NAMES = {
  "admin@pmo.test":        "PMO Admin",
  "pm.strategy@pmo.test":  "Mohammed",
  "pm.digital@pmo.test":   "Ali",
  "head.digital@pmo.test": "Digital Head",
  "head.it@pmo.test":      "IT Head",
  "exec@pmo.test":         "Executive User",
};

export function useCurrentUser() {
  const { instance, accounts } = useMsal();

  if (USE_MOCK) {
    return {
      account:         null,
      name:            MOCK_NAMES[MOCK_EMAIL] ?? "Mock User",
      email:           MOCK_EMAIL,
      isAuthenticated: true,
      role:            "viewer",
      logout:          () => {},
    };
  }

  const account = accounts[0] ?? null;
  return {
    account,
    name:            account?.name     ?? "",
    email:           account?.username ?? "",
    isAuthenticated: !!account,
    role:            "viewer",
    logout: () =>
      instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin }),
  };
}
