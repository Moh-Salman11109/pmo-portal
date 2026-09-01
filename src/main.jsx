import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/responsive.css";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./services/auth.js";
import App from "./App.jsx";
import AuthGuard from "./components/AuthGuard.jsx";
import DocGenerator from "./components/DocGenerator.jsx";
import { env } from "./config/runtimeEnv.js";

// Mock mode bypasses all authentication — the app loads directly with mock data.
// Live mode requires a Microsoft 365 login before the app renders.
const USE_MOCK = env.VITE_USE_MOCK !== "false";

// Doc Generator opens in its OWN browser tab (?docgen=1). It's a stateless
// stationery machine — no SharePoint, no login needed — so we render it
// standalone, bypassing the app shell and auth. Isolating it in its own tab
// also means a stray Backspace there can never affect the main portal.
const dgParams = new URLSearchParams(window.location.search);
const isDocGen = dgParams.get("docgen") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isDocGen ? (
      <DocGenerator onClose={() => window.close()} currentUserName={dgParams.get("u") || ""} />
    ) : USE_MOCK ? (
      <App />
    ) : (
      <MsalProvider instance={msalInstance}>
        <AuthGuard>
          <App />
        </AuthGuard>
      </MsalProvider>
    )}
  </React.StrictMode>
);
