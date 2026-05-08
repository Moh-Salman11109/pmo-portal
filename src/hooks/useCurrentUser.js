import { useMsal } from "@azure/msal-react";

// ── Exposes the signed-in user's identity and logout action ──────────────────
// Role detection is a stub — Phase 2C will call Graph /me/memberOf and map
// Azure AD group IDs to: "pmo_admin" | "pm" | "executive" | "viewer"
export function useCurrentUser() {
  const { instance, accounts } = useMsal();
  const account = accounts[0] ?? null;

  return {
    account,
    name:            account?.name     ?? "",
    email:           account?.username ?? "",
    isAuthenticated: !!account,
    role:            "viewer", // Phase 2C: real group membership lookup
    logout: () =>
      instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin }),
  };
}
