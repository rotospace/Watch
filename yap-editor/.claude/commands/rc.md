---
description: Remote control — expose the review page so it can be approved/denied from a phone off-network
---

Start the review server and put it on a public URL so the user can approve/deny
renders from their phone, wherever they are:

1. Run `python scripts/server.py` in the background (default port 8787).
2. If `cloudflared` is installed, run `cloudflared tunnel --url http://localhost:8787`
   in the background and read the `https://*.trycloudflare.com` URL it prints. If it's
   not installed, tell the user to install it (`brew install cloudflared` on macOS, or
   see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
   and stop — don't try to work around a missing tunnel tool.
3. Report the public review URL back to the user.
4. Optionally, if `NTFY_TOPIC` is set in the environment, mention that they'll get a
   push notification on approve/deny via ntfy.sh — no setup needed beyond installing
   the ntfy app and subscribing to that topic name.
5. Leave both processes running. Keep watching `review/state.json`: when a pending
   version flips to `approved` or `denied`, act on it per `CLAUDE.md` (approved = done,
   denied = ask what to change or re-run the pipeline with adjustments) rather than
   waiting to be asked again.
