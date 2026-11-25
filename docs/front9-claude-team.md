# Front9 Claude team (subagents)

Seven Claude Code subagents that take over the Grok bot fleet's work, lane by
lane. They live in `.claude/agents/front9/`. Shared rules live in
`.claude/skills/front9-rules/SKILL.md`. Private facts (prices, client names,
emails) are never stored here; agents read them from the Fact File in the
Shared AI Brain.

## Why it costs less

- **No bot-to-bot chat.** On Oct 30, about 74% of Grok tokens were bots talking
  to bots. Here, specialists never message each other. Each one returns a
  one-line handoff to the Chief, and only that line moves on.
- **Cheap models for cheap jobs.** Lookups, checks and money reports run on
  Haiku. Research, writing and building run on Sonnet. Nothing runs on Opus
  by default.
- **Small context.** Each specialist starts clean, reads only the files its job
  needs, and loads only its own tools. The Librarian, Checker and Finance
  agents also skip CLAUDE.md.
- **No nesting.** Only the Chief can start other agents.
- **No polling.** Scheduled runs are hourly at most, or start from an email.

## Grok bot to Claude agent

| Claude agent | Model | Covers these Grok bots | Can change things? |
|---|---|---|---|
| `front9-chief` | Sonnet | Ops, Initial Intake, Quota Bot, THE MAN, AGH Overlord (routing), Organization Bot, My Crazy Idea Bot | Handoff Log only |
| `front9-librarian` (new) | Haiku | Fact lookups every bot used to do on its own | No |
| `front9-scout` | Sonnet | Score, Signal, Reviews, AISV (audits), Rank (plans), F9 SA prospectors | No |
| `front9-writer` | Sonnet | Promo, Outreach (copy), Closer (proposal copy), Care (reply drafts), blog | Gmail drafts only |
| `front9-builder` | Sonnet | Launch (prep only), Onboard, AISV and Rank fixes | Its own worktree only; a hook blocks deploys |
| `front9-checker` | Haiku | Ship Check | No |
| `front9-finance` | Haiku | Finance (read only) | No |

**Stays with Grok for now:** production deploys (Launch), Stripe payment links
(Closer), sending outreach, customer support until the side-by-side test, and
Finance Bot / StockBot (personal, out of scope).

## How to use it

- Start the team: `claude --agent front9-chief` from this repo, then ask in
  plain words.
- Call one specialist directly: `@agent-front9-writer draft a LinkedIn post
  about holiday hours`.
- The connectors the agents use (Google Drive, Docs, Sheets, Gmail) must be
  connected in the session.

## Safety

- Every agent preloads `front9-rules`: nothing is sent, posted, deployed,
  deleted or paid for without Jason's yes in the conversation.
- The Writer cannot call Gmail send, reply or forward.
- The Builder works in a separate git worktree, and
  `.claude/hooks/front9-block-live-changes.sh` blocks deploy commands and
  pushes to `main`.
