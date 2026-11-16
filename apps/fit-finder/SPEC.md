# Front9 Fit Finder: spec

A short Q&A that tells a visitor which Front9 products fit them: **Intel**,
**Dev**, **Social**, **Apps**, or **Front9 Ultra** (all four, plus the
enterprise AI corporate install when they need it). The original
`front9-fit-finder-spec.md` was not in this repo, so this spec was rebuilt from
the September 2026 prototype and extended. The code in `logic.js` is the
source of truth for every rule below.

## Who it's for

Traffic is a mix of cold prospects and warm leads. The first question asks how
well they know Front9, and the copy on every later screen adapts to the answer:

| Familiarity | Tone | What changes |
|---|---|---|
| `new`, first time hearing of Front9 | Plain language, explains each product | Product cards use outcome language ("We watch your competitors for you…"), done screen promises a fit report, not a sales call |
| `basics`, knows the basics | Short, product names up front | Product cards are one-liners with the Front9 name |
| `client`, already a client | "What to add" | Extra screen asks what they already own; owned products are marked and can't be re-picked; reveal can recommend an Ultra upgrade; done screen names their account lead |

A link can skip the question: `?f=new`, `?f=basics`, or `?f=client`. Use
`?f=client` in client emails. `utm_source`, `utm_medium`, `utm_campaign`, and
`ref` are stored on the lead.

## Flow

```
welcome → familiarity → [owned, clients only] → companySize → needs → [install] → reveal → contact → done
```

The **install** screen appears when any of these is true:

- company size is `enterprise`
- they'd end up with all four products (owned + picked)
- company size is `multi` and they'd end up with three or more

## Recommendation

"Coverage" is what they'd have after buying: owned products plus picks.

1. Install answer is **yes** (private install, SSO, data residency): **Ultra + enterprise install**.
2. Coverage is all four: **Ultra**.
3. Company size is `multi` or `enterprise` and coverage is three: **Ultra**, with the à la carte option named underneath.
4. Otherwise: the individual products they picked. If any are left out, a note says Ultra bundles all four at a better rate.

An **unsure** install answer never forces Ultra. It adds a note that the call
will cover shared cloud versus private install, and is saved as
`installInterest: "unsure"` so sales can follow up.

> **Open question:** can the enterprise AI corporate install be sold without
> Ultra? Rule 1 assumes it can't. If it can, rule 1 should instead attach the
> install to whatever individual products were picked, and the reveal screen
> should show it as an add-on. It's one branch in `recommend()`.

## Submission data model (`schema: 2`)

```json
{
  "schema": 2,
  "createdAt": 1763276400000,
  "source": { "utm_source": "newsletter", "utm_campaign": "q4" },
  "familiarity": "client",
  "owned": ["intel", "dev"],
  "companySize": "growing",
  "needs": ["social", "apps"],
  "installInterest": "no",
  "recommendation": { "tier": "ultra", "reason": "all-four", "products": ["intel","dev","social","apps"], "includesInstall": false },
  "contact": { "name": "", "email": "", "company": "", "phone": "", "note": "" }
}
```

`reason` is one of `install`, `all-four`, `scale`, `picked`. The dashboard
also reads the prototype's flat rows (no `schema` field).

## Where leads go

`app.js` picks the first that's available:

1. **Claude artifact** (`window.claude`): the artifact's shared `leads` collection. The owner sees a Leads button.
2. **Endpoint**: set `window.FIT_FINDER_CONFIG = { endpoint: "https://…" }` before `app.js`; each lead is POSTed as JSON. Use this to send leads to a CRM webhook (HubSpot, Zapier, etc.).
3. **Demo**: saved in the browser's localStorage. Add `?leads` to the URL to see the dashboard.

## Owner dashboard

Counts for responses, warm leads (`basics` + `client`), Ultra fits, install
requests, most-requested product, and average needs per lead; a table of
leads; and CSV export (formula-safe).

## Design

Archivo headings, Work Sans body, IBM Plex Mono numbers. Indigo accent for
the flow, gold for anything Ultra. Light and dark themes, single column at
phone width, no horizontal scroll at 390px, keyboard focus moves to each
screen's heading.
