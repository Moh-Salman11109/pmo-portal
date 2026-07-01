#!/bin/sh
# Render /config.js from the container environment at startup.
#
# The nginx official entrypoint runs every /docker-entrypoint.d/*.sh before
# launching nginx. We emit window.__APP_CONFIG__ containing every VITE_* env
# var present in the pod, so the SPA (which reads window.__APP_CONFIG__ via
# src/config/runtimeEnv.js) is configured per-environment without a rebuild.
set -eu

TARGET="/usr/share/nginx/html/config.js"

# Escape backslashes and double quotes so values are safe inside a JS string.
escape() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

{
    printf 'window.__APP_CONFIG__ = {\n'
    for name in $(env | sed -n 's/^\(VITE_[A-Za-z0-9_]*\)=.*/\1/p'); do
        value=$(printenv "$name" || printf '')
        printf '  "%s": "%s",\n' "$name" "$(escape "$value")"
    done
    printf '};\n'
} > "$TARGET"

echo "40-render-config.sh: wrote runtime config to $TARGET"
