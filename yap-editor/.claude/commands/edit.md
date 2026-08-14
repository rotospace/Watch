---
description: Run the full yap-editor process on whatever's in raw/
---

Follow `CLAUDE.md` in this project exactly, start to finish, for the take(s) currently
in `raw/`:

1. Pin one focus — state it in a sentence before doing anything else.
2. Run `scripts/pipeline.py --raw raw/ --focus "<that sentence>"` (use a new
   `--session` name only if this is a distinct video, not a re-edit of the same one).
3. Read the pipeline output. If `diff_check` fails, fix the render and re-run before
   saying anything is ready.
4. Tell the user the review page is updated and to open it (locally or via `/rc` if
   they're not on the same network) and approve or deny the new version.
5. Stop. Do not render another version or call anything "final" until `review/state.json`
   shows that version as `approved`.

If `raw/` is empty, say so and stop — don't ask clarifying questions the playbooks
already answer; only ask about things the playbooks genuinely don't cover.
