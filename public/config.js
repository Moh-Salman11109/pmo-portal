// Runtime configuration placeholder.
//
// Local dev (`vite dev` / `vite preview`): this file is served as-is and
// intentionally sets NO values, so the app falls back to Vite's build-time
// `.env` (import.meta.env.VITE_*).
//
// Production container: the nginx entrypoint (docker/40-render-config.sh)
// OVERWRITES this file at startup with values from the pod environment.
// Keep the object present but empty here.
window.__APP_CONFIG__ = {};
