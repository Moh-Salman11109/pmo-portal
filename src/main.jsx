import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/responsive.css";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./services/auth.js";
import App from "./App.jsx";
import AuthGuard from "./components/AuthGuard.jsx";

// Mock mode bypasses all authentication — the app loads directly with mock data.
// Live mode requires a Microsoft 365 login before the app renders.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {USE_MOCK ? (
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
