import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../services/auth.js";

// Microsoft logo SVG squares
function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

export default function LoginScreen() {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function signIn() {
    setLoading(true);
    setError("");
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError("Sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", width: "100vw",
      background: "linear-gradient(135deg, #002d26 0%, #003932 60%, #005244 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#ffffff", borderRadius: 20,
        padding: "52px 56px", maxWidth: 420, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "#003932", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
            color: "#00FFB3", fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px",
          }}>
            tree
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#003932", letterSpacing: -0.5 }}>
            PMO Portal
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#5a7a6e", fontWeight: 500 }}>
            Enterprise Project Management Office
          </p>
        </div>

        {/* Sign-in button */}
        <button
          onClick={signIn}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 12, width: "100%", padding: "15px 24px",
            borderRadius: 12, border: "none",
            background: loading ? "#5a7a6e" : "#003932",
            color: "#00ffb3", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            letterSpacing: 0.2,
          }}
        >
          <MicrosoftLogo />
          {loading ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
        </button>

        {error && (
          <p style={{ marginTop: 14, fontSize: 13, color: "#991b1b", textAlign: "center" }}>
            {error}
          </p>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 32, paddingTop: 24,
          borderTop: "1px solid #e8f0e8", width: "100%", textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#a1b9ab" }}>
            Secure internal access · Microsoft 365 authentication
          </p>
        </div>
      </div>
    </div>
  );
}
