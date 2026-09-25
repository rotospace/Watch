---
name: clone-ads
description: Use when the user wants to generate AI ad-video variations that feature a cloned likeness of themselves (or another subject), using Higgsfield's MCP video/image tools. Clones a person from reference photos/video into a reusable AI "character," then produces several ad script/style variations as short talking-head videos. Triggers on "clone myself into an ad", "make ad videos with my likeness", "Higgsfield clone", "clone from my social", "generate N ad variations of me".
---

# Clone Ads

Automates the workflow: reference footage of a person -> trained AI character ->
several distinct ad-video variations for a product, using Higgsfield's tools over MCP.

## 0. Confirm Higgsfield MCP is connected

Run `ToolSearch` with query `"higgsfield"`. If no `mcp__higgsfield__*` (or similarly
named) tools come back, **stop** and tell the user to connect it first:

- Claude Code (local): `claude mcp add higgsfield <server-url> --transport http --scope user`,
  then trigger one Higgsfield tool call — it opens a browser OAuth flow against their
  Higgsfield account. No API key needed for the official hosted server.
- claude.ai / Cowork: connect it from the connector settings in the UI.

Do not attempt this OAuth flow from a sandboxed/remote session with no browser —
it has to happen in the user's own local environment.

Once connected, call each candidate tool's schema (ToolSearch surfaces it) before use —
exact tool names and parameters vary by server version, so read the schema rather than
guessing field names.

## 1. Gather inputs

Ask the user for, if not already given:
- **Reference material**: 5-10 clear photos and/or a short video of the subject
  (varied angles/expressions gives a better clone). Local file paths or a folder.
- **Product**: name, one-line description, and a product image if there is one.
- **Angle count**: how many distinct ad variations to produce (default 3-5).
- **Tone/format**: e.g. talking-head selfie style, voiceover-only, specific platform
  (TikTok/Reels vertical 9:16 is the usual default for this kind of ad).

## 2. (Optional) Research comparable ads

If the user wants data-driven scripts rather than freehand ones, use WebSearch (or a
connected YouTube Data API / analytics tool, if available) to find high-performing ads
in the same product category. Pull out the opening hook, pacing, and structure of the
top few — not their exact wording — and use that shape to inform step 4.

## 3. Create the character (clone)

Call the character/training tool with the reference photos (and video if supplied).
This is typically async — poll the status tool until training reports ready before
generating anything with it. Confirm the character id/name back to the user.

## 4. Draft N ad scripts

Write one short spoken script per variation (a few sentences, matched to a ~10-20s
video). Give each variation a genuinely different angle — e.g. pain-point hook,
social-proof hook, urgency/offer hook, demo-style — don't just reword the same script.

## 5. Generate each variation

For each script, call the video-generation tool with:
- the trained character as the subject/face reference
- the script as spoken audio/prompt text
- if a reference performance clip was supplied, request the model match its
  camera motion / hand movement / lip sync rather than a static talking head
- vertical 9:16 framing unless the user asked for something else

Poll generation status per clip; download completed outputs into a local folder
(use the scratchpad or a path the user specifies).

## 6. Deliver

Summarize as a table: variation -> angle -> script line -> output file. Send the
finished videos to the user (`SendUserFile`) rather than just leaving them on disk.
