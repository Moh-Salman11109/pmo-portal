import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";

// ── Derive SharePoint resource origin from the site URL env var ──────────────
// Works for any tenant / hosting — never hardcoded.
const spOrigin = (() => {
  try { return new URL(import.meta.env.VITE_SP_SITE_URL || "").origin; }
  catch { return ""; }
})();

// ── MSAL configuration ───────────────────────────────────────────────────────
// redirectUri defaults to window.location.origin so the same build works on
// any internal server, Azure SWA, or IIS without rebuilding.
export const msalConfig = {
  auth: {
    clientId:    import.meta.env.VITE_AZURE_CLIENT_ID  || "",
    authority:   `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "common"}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation:          "sessionStorage", // cleared on tab close
    storeAuthStateInCookie: false,
  },
};

// ── Scopes ───────────────────────────────────────────────────────────────────

// Initial login — user identity only
export const loginRequest = {
  scopes: ["User.Read", "openid", "profile"],
};

// SharePoint REST API token — all delegated SP permissions for the signed-in user
export const spRequest = {
  scopes: spOrigin ? [`${spOrigin}/.default`] : [],
};

// ── Singleton MSAL instance ──────────────────────────────────────────────────
// MsalProvider handles initialize() automatically. Do not call initialize()
// manually before passing to MsalProvider.
export const msalInstance = new PublicClientApplication(msalConfig);

// ── Token acquisition helper (used by sharepoint.js) ────────────────────────
export async function acquireSpToken() {
  const account = msalInstance.getActiveAccount()
               || msalInstance.getAllAccounts()[0];
  if (!account) throw new Error("No authenticated account — sign in first");

  try {
    const result = await msalInstance.acquireTokenSilent({ ...spRequest, account });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Token expired or consent needed — redirect to re-authenticate
      await msalInstance.acquireTokenRedirect({ ...spRequest, account });
      return ""; // browser will redirect; this line is never reached
    }
    throw err;
  }
}
