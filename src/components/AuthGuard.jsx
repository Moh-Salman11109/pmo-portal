import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import LoginScreen from "./LoginScreen.jsx";

// ── Auth gate ────────────────────────────────────────────────────────────────
// Renders children only when a Microsoft account is confirmed.
// Shows nothing while MSAL is processing the redirect (avoids flash of login).
// MsalProvider handles handleRedirectPromise() automatically.
export default function AuthGuard({ children }) {
  const { inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // MSAL is still initialising or processing the OAuth redirect response
  if (inProgress === "startup" || inProgress === "handleRedirect") {
    return null;
  }

  if (!isAuthenticated) return <LoginScreen />;

  return children;
}
