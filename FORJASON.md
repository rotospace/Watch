# FORJASON.md — Marketing companion setup → Front9 AI outreach pipeline

## 1. The approach

You started this at "become my ultimate marketing companion" — pretty open-ended. First move was mechanical: clone `coreyhaines31/marketingskills` and drop it into `.agents/skills/` so I'd have real, vendored playbooks to work from instead of freelancing from memory. That's a meaningful difference — "write me a cold email" from memory vs. "write me a cold email following this specific skill's rules" produces different output, and it made every later decision traceable to a written rule instead of my taste.

From there it went in a straight line: rewrite the app's default email sequence against the `cold-email` skill's actual data (subject line length, "following up" being a documented reply-killer, etc.) → add a `{{signal}}` field so personalization could be per-prospect instead of per-industry → go find real leads to prove the feature out → discover you wanted a no-calls, email-to-signup motion instead of the call-booking one the app defaults to → discover mid-stream that another session had been building UX features on the same app in parallel → reconcile that → fix your actual brand identity after I'd gotten it wrong → ship the whole thing as one PR.

The throughline: build the smallest real thing at each step, then actually go use it (real web research, real browser tests) before adding the next layer.

## 2. Roads not taken

**Scraping Google Maps directly with a real browser.** I have Playwright/Chromium available and used them plenty (to test the app). I did *not* point them at Google Maps or individual business websites for the lead research. Two independent reasons killed it: the network egress proxy in this environment returns a flat 403 policy denial for `google.com` and arbitrary business domains — I tested this directly with `curl` through the proxy to prove it wasn't a fixable software issue. And separately, even if the network allowed it, the `prospecting` skill's own compliance section explicitly bans bulk/automated Google Maps scraping and bot-detection bypass — so it was blocked twice over, once by infrastructure and once by the rules I was told to follow. I used `WebSearch` instead — slower, noisier, but it's the legitimate path.

**Rebasing instead of merging the two git branches.** When I found the other session's branch, my instinct was to think about which branch should "win" and rebase the loser onto the winner for a clean linear history. I didn't, because rebase rewrites commit history, and I'd already told you "I haven't touched that other branch and won't unless you ask." A merge commit brings both histories together without altering either one — slightly messier log, zero risk of clobbering the other session's work.

**Making the "no calls, just signup" CTA the app's new default for everyone.** After you asked for the signup-focused approach, the tempting move was to rewrite `data.js`'s shared `SCRIPT_FRAMEWORK` so every future industry/lead got that treatment. I asked you first, you said "just these 9 leads," so I wrote the copy as standalone files instead of touching the shared template. Smaller blast radius — if it turns out you actually want that everywhere, that's still a clean, separate change later instead of something baked in by accident.

**Guessing at missing facts to make output look complete.** Multiple times I didn't have a real owner name, a real email, or a real proof point. The tempting move is always to write something plausible-sounding so the deliverable looks finished. I left those blank or marked "not found" instead, every time. A believable-but-wrong fact in a cold email is strictly worse than an honest gap, because the gap is visible and the wrong fact isn't — until a prospect notices.

## 3. How the pieces connect

Order mattered more than it looks like from the outside:

1. Skills library first, because everything downstream cites it.
2. Cold-email rewrite second, because it's the thing the skill directly governs and it's low-risk (just copy in one file).
3. `{{signal}}` field third — this only makes sense *after* the cold-email rewrite exists, since it's a slot in that template.
4. Real prospecting research fourth — this is the thing that actually fills the `{{signal}}` field with true data instead of a placeholder. Doing research before the feature existed would've meant redoing the write-up.
5. The branch merge happened out of sequence — I didn't plan for it, I found it because you asked "where should I continue this conversation." That's the one piece that wasn't sequential; it was a fork I had to graft back on.
6. The Front9 AI correction had to happen in *two* places, and the order there mattered too: I fixed the app's "Fill defaults" button before regenerating the email copy files. If I'd done it the other way, the button would've kept producing wrong data even after I'd manually fixed the copy once — the bug would've just resurfaced the next time anyone clicked it.
7. PR last, because it's the "ship all of the above as one reviewable diff" step — bundling it any earlier would've meant reviewing a half-finished thing.

## 4. Tools, methods, frameworks

- **WebSearch, not a browser, for lead research.** Slower and noisier (search-engine summaries instead of clean structured data), but it's the tool that's actually allowed here. If Clay or TomTom Maps get turned on in this chat (I flagged both as available-but-off earlier), the same research would come back faster and with verified contact data instead of me triangulating across 3-4 search results per business.
- **Playwright + a real headless Chromium, run after every single change** — not just `node --check` for syntax. This is what caught the merge bug (see #6) and confirmed the Front9 fix actually rendered right. A syntax check tells you the code parses; it tells you nothing about whether the merged table has the right number of columns.
- **`git merge`, explicitly not `git rebase`,** for combining the two branches — see road-not-taken #2 for why.
- **The vendored skill files as the literal spec**, not "cold email best practices" from training. When I rewrote the subject lines, I was matching specific data in `cold-email/references/subject-lines.md` (2-4 words, lowercase, no first name in subject — each of those is a cited number in that file, not a vibe).

## 5. Tradeoffs

- **Lead-list size vs. verification depth.** I capped every batch at ~9 leads with 2+ independent sources per claim, instead of a longer list with weaker backing. You get fewer names per batch but every "no website" claim is actually true.
- **Honesty vs. polish.** Blank fields and "not found" markers instead of invented owner names/proof points. The output looks less finished but isn't lying to you.
- **Not renaming the internal `booking_link` merge field/state key, only the UI label.** I could have done a clean rename to `cta_link` everywhere. I didn't, because that key already exists in the app's saved-state shape and in `data.js`'s templates — renaming it risks breaking anything that already reads `{{booking_link}}` (including any script overrides someone might already have saved). The cost: there's now a small mismatch between what the label says ("CTA link") and what the code calls it internally (`booking_link`) — a future contributor reading the code will have to know that history.
- **Merging two branches by hand vs. asking you to just pick one.** Merging preserved both sessions' work (nobody's effort got thrown away), but it cost real time — 9 separate conflict blocks resolved one at a time, plus catching and fixing the row-alignment bug the auto-merge introduced on its own.

## 6. Mistakes and dead ends

- **The merge silently broke the inline-edit row.** Both branches added a table column (mine: Signal; theirs: Website + Sent). Git's merge algorithm doesn't understand that two independently-added columns both need a placeholder cell in the edit-mode row — it just kept whatever was there before, which was one placeholder short. If I'd trusted the "merge succeeded, no conflicts here" signal and not actually clicked "Edit" on a real prospect row in a real browser afterward, every cell after that row would've silently shifted one column to the left in edit mode. Fixed by literally testing it, not by reading the diff harder.
- **A merge field referencing itself.** I wrote a proof-point default that included `{{business_name}}` inside it, not realizing the merge engine only does one pass — it substitutes `{{proof_point}}` with your raw text, but doesn't then re-scan *that* text for more merge fields. Every step-2 email would've printed the literal string `{{business_name}}` instead of the actual business name. Caught before it shipped, but it's the kind of bug that's invisible until you look at real rendered output.
- **Got your company's name and business model wrong for a full round.** The web-search-sourced draft (from the other session, honestly labeled "verify before use") said "Front9 Agency" doing SEO/PPC/drone video. I used it, generated 27 emails with it, and you had to correct me: it's "Front9 AI," an AI-powered service, not an agency. That correction had to be applied in two places — the reusable app button *and* every email file already generated — because the wrong fact had already propagated.
- **Blurred test data and real content, briefly.** While testing the app in Playwright I used fake sender info ("Jordan Fields," "Palm Digital Co.") to prove the merge logic worked. Had to be deliberate about never letting that leak into anything you'd actually send — test fixtures and real deliverables need a harder wall than feels natural when you're moving fast between "does the code work" and "is the content right."

## 7. Pitfalls to watch for

- **Any AI-sourced claim about your own company needs a human check before it goes into something that runs many times.** A wrong fact in a one-off answer costs you one wrong sentence. A wrong fact baked into a reusable template or a "fill defaults" button costs you every future use of it until someone catches it.
- **Two AI sessions touching the same repo will conflict, and the gap between "cheap to reconcile" and "expensive to reconcile" grows fast.** These two branches were about a week apart and already had real conflicts in every shared file. If you're running parallel sessions on the same project again, either scope them to different files/areas up front, or check in and merge sooner rather than letting both run long.
- **"Free, no card required" and similar trust claims in outreach copy are promises, not filler.** If the actual product ever requires a card or isn't literally free, that copy becomes a compliance and trust problem, not just an inaccurate sentence.
- **A clean `git merge` exit code is not proof the merge is correct** — it's proof there was no *textual* overlap. Structural correctness (does this table still have the right number of columns, does this feature still work end to end) needs an actual test, every time.

## 8. Expert vs. beginner eye

A beginner's version of this lead-gen work is "here are 10 roofers in West Palm Beach." What actually separates it: every "no website" claim traceable to 2+ sources; businesses with a closed/dissolved status (Roof It Better, Baro Family Dental) explicitly called out and excluded rather than silently kept in the list because they showed up in search results; and personalization that's tied to the *specific* gap for that business, not a mail-merged first name. On the code side: a beginner runs `git merge`, sees "Auto-merging... done," and moves to the next task. The tell of someone who's been burned before is treating a conflict-free merge as *unverified* until they've actually clicked through the merged feature in a real browser — which is exactly what caught the broken table row.

## 9. Transferable lessons

- **"Verify before it becomes a template" generalizes way past cold email.** Any time an LLM's output is going to be reused as a prompt, a script, a form default, or a template that runs N times — the verification bar needs to be higher than for a one-off chat answer, because errors don't cost you once, they cost you N times. This applies to prompt libraries, saved Zapier/automation steps, README boilerplate, anything with "fill defaults" energy.
- **The merge-then-test discipline isn't specific to this app.** Any time you're combining work from two sources (two branches, two contractors, two drafts of a document), the actual risk isn't the parts that conflict and get flagged — it's the parts that merge *silently* and are wrong anyway. Test the seams, not just the diff.
- **The "signal check" product and the `{{signal}}` feature turning out to be the same idea was a genuine coincidence worth noticing, not engineering.** I built a manual research process (find businesses, check their web presence, note the specific gap) completely independently from knowing what Front9 AI does — and it turned out your product automates exactly that process. When two threads of work you're running turn out to be the same idea from two angles, that's a signal (no pun intended) to point them at each other instead of running them separately — in this case, literally: the entire outreach motion is now "we manually found this gap for you once, our product finds it automatically."
