#!/usr/bin/env bash
# PostToolUse hook — advisory code review of a just-changed file.
#
# Fires after Edit/Write. It spawns a fresh headless Claude ("review sub-agent")
# that runs the read-only /code-review skill on the changed file and surfaces
# the findings back as advisory context. It is NON-BLOCKING: it never fails the
# edit (always exits 0) and never modifies files.
#
# Disable at any time with:  export PMO_DISABLE_REVIEW_HOOK=1
set -uo pipefail

# Kill switch, and recursion guard so the sub-agent's own tool calls (which
# re-trigger this hook inside the headless process) short-circuit immediately.
[ "${PMO_DISABLE_REVIEW_HOOK:-}" = "1" ] && exit 0
[ "${PMO_REVIEW_HOOK_ACTIVE:-}" = "1" ] && exit 0

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -z "$file" ] && exit 0

# Skip vendored, generated, VCS, and Claude-internal paths.
case "$file" in
  */node_modules/*|*/dist/*|*/dist-ssr/*|*/.git/*|*/.claude/*) exit 0 ;;
esac

# Only review source / infra files worth a review pass.
case "$file" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs|*.css|*.json|*.yml|*.yaml|*.sh|*Dockerfile) : ;;
  *) exit 0 ;;
esac

command -v claude >/dev/null 2>&1 || exit 0

rel="${file#"${CLAUDE_PROJECT_DIR:-$PWD}"/}"

# Read-only review in plan mode; guard var prevents recursive hook firing.
review=$(PMO_REVIEW_HOOK_ACTIVE=1 claude -p "/code-review $rel" \
           --permission-mode plan 2>/dev/null | head -c 4000 || true)
[ -z "$review" ] && exit 0

# Surface as advisory context — shown to the assistant, edit still proceeds.
jq -cn --arg ctx "Automated review of ${rel}:
${review}" \
  '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
exit 0
