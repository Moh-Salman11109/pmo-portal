// Runtime-injectable environment configuration.
//
// Why this exists: `import.meta.env.VITE_*` is replaced by Vite at BUILD time,
// so a value that isn't set when `vite build` runs is frozen as its fallback.
// The container image is built once with NO VITE_* values, then the nginx
// entrypoint writes `/config.js` at container startup, setting
// `window.__APP_CONFIG__` from the pod's environment. That lets a single
// immutable image serve every environment (dev/prod) without rebuilding.
//
// Precedence: runtime `window.__APP_CONFIG__` overrides build-time values.
// Empty/undefined runtime values are ignored so they never clobber the
// hardcoded fallbacks used throughout the app (e.g. `|| ""`).
//
// Usage: `import { env } from "…/config/runtimeEnv.js"` then read
// `env.VITE_FOO`. Vite built-ins (`import.meta.env.DEV`, `.MODE`, `.PROD`)
// must keep using `import.meta.env` directly — those are correct at build time.

const runtimeRaw =
  (typeof window !== "undefined" && window.__APP_CONFIG__) || {};

const runtime = Object.fromEntries(
  Object.entries(runtimeRaw).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  )
);

export const env = { ...import.meta.env, ...runtime };
