#!/usr/bin/env bash
# PreToolUse hook for the front9-builder subagent.
# Blocks Bash commands that would deploy or change something live.
# Exit code 2 blocks the call and shows the message to the agent.

input="$(cat)"
cmd="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)"

pattern='(wrangler[[:space:]]+(pages[[:space:]]+)?(deploy|publish))|(vercel([[:space:]].*)?--prod)|(netlify[[:space:]]+deploy.*--prod)|(git[[:space:]]+push([[:space:]].*)?[[:space:]](main|master|production|prod)([[:space:]]|$))|(git[[:space:]]+push[[:space:]].*--force)|(firebase[[:space:]]+deploy)|(gh[[:space:]]+pr[[:space:]]+merge)'

if printf '%s' "$cmd" | grep -Eqi "$pattern"; then
  echo "Blocked: front9-builder prepares packages but never deploys or pushes to a live branch. Hand the package to the Chief instead." >&2
  exit 2
fi
exit 0
