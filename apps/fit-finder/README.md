# Front9 Fit Finder

A static, dependency-free quiz that recommends Front9 Intel, Dev, Social, Apps,
or Front9 Ultra. Rules and data model: [SPEC.md](SPEC.md).

## Run it

```bash
cd apps/fit-finder && python3 -m http.server 8765
# open http://localhost:8765/            cold-prospect flow
# open http://localhost:8765/?f=client   client flow
# open http://localhost:8765/?leads      shows the Leads dashboard button
```

## Test it

```bash
node --test apps/fit-finder/logic.test.js
```

## Files

| File | What it is |
|---|---|
| `logic.js` | All rules: flow path, adaptive copy, recommendation, lead record, CSV. No DOM. |
| `app.js` | Wires `logic.js` to the page, storage, and the owner dashboard. |
| `index.html`, `styles.css` | Markup and styles. |
| `logic.test.js` | Unit tests for `logic.js`. |

`apps/` is listed in `.skillignore`, so it's never packaged with the `/watch` skill.
