// Run: node --test apps/fit-finder/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./logic.js");

const base = (o) => Object.assign({ familiarity: "basics", owned: [], needs: [] }, o);

test("path adds the owned-products question only for clients", () => {
  assert.ok(!F.buildPath(base({})).includes("owned"));
  assert.ok(F.buildPath(base({ familiarity: "client" })).includes("owned"));
});

test("install question: enterprise, all four, or multi-location with 3+", () => {
  assert.ok(!F.needsInstallQuestion(base({ companySize: "solo", needs: ["intel"] })));
  assert.ok(F.needsInstallQuestion(base({ companySize: "enterprise", needs: ["intel"] })));
  assert.ok(F.needsInstallQuestion(base({ companySize: "solo", needs: ["intel", "dev", "social", "apps"] })));
  assert.ok(F.needsInstallQuestion(base({ companySize: "multi", needs: ["intel", "dev", "social"] })));
  assert.ok(!F.needsInstallQuestion(base({ companySize: "growing", needs: ["intel", "dev", "social"] })));
});

test("individual products when nothing triggers Ultra", () => {
  const r = F.recommend(base({ companySize: "growing", needs: ["social", "intel"] }));
  assert.equal(r.tier, "individual");
  assert.deepEqual(r.products, ["intel", "social"]);
  assert.deepEqual(r.missing, ["dev", "apps"]);
});

test("all four needs -> Ultra", () => {
  const r = F.recommend(base({ companySize: "solo", needs: ["intel", "dev", "social", "apps"], install: "no" }));
  assert.equal(r.tier, "ultra");
  assert.equal(r.reason, "all-four");
  assert.equal(r.includesInstall, false);
});

test("private install -> Ultra with the enterprise install", () => {
  const r = F.recommend(base({ companySize: "enterprise", needs: ["intel"], install: "yes" }));
  assert.equal(r.tier, "ultra");
  assert.equal(r.reason, "install");
  assert.equal(r.includesInstall, true);
});

test("unsure about install does not force Ultra", () => {
  const r = F.recommend(base({ companySize: "enterprise", needs: ["intel"], install: "unsure" }));
  assert.equal(r.tier, "individual");
  assert.equal(r.installInterest, "unsure");
});

test("big org with three of four -> Ultra by scale", () => {
  const r = F.recommend(base({ companySize: "multi", needs: ["intel", "dev", "social"], install: "no" }));
  assert.equal(r.tier, "ultra");
  assert.equal(r.reason, "scale");
});

test("client who owns two and adds two is upgraded to Ultra", () => {
  const a = base({ familiarity: "client", owned: ["intel", "dev"], companySize: "growing", needs: ["social", "apps"] });
  const r = F.recommend(a);
  assert.equal(r.tier, "ultra");
  assert.equal(r.upgrade, true);
  assert.equal(F.revealHeadline(r, a), "Time to move to Ultra.");
});

test("owned products never show up as new recommendations", () => {
  const a = base({ familiarity: "client", owned: ["intel"], companySize: "solo", needs: ["intel", "dev"] });
  assert.deepEqual(F.recommend(a).products, ["dev"]);
});

test("owned is ignored for non-clients", () => {
  assert.deepEqual(F.owned(base({ familiarity: "new", owned: ["intel"] })), []);
});

test("copy adapts to familiarity", () => {
  assert.notEqual(F.copyFor("welcome", { familiarity: "new" }).headline, F.copyFor("welcome", { familiarity: "client" }).headline);
  assert.equal(F.copyFor("welcome", {}).headline, F.copyFor("welcome", { familiarity: null }).headline);
  const rec = F.recommend(base({ familiarity: "client", owned: ["intel"], companySize: "solo", needs: ["dev"] }));
  assert.match(F.doneSub(rec, { familiarity: "client" }), /account lead.*Front9 Dev/);
});

test("recommendation labels read naturally", () => {
  assert.equal(F.recommendationLabel({ tier: "individual", products: ["intel", "dev", "social"] }), "Front9 Intel, Front9 Dev and Front9 Social");
  assert.equal(F.recommendationLabel({ tier: "ultra", includesInstall: true }), "Front9 Ultra with the enterprise install");
});

test("contact validation", () => {
  assert.deepEqual(F.validateContact({ name: "A", email: "a@b.co", company: "C" }), {});
  const e = F.validateContact({ name: " ", email: "nope", company: "" });
  assert.deepEqual(Object.keys(e).sort(), ["company", "email", "name"]);
});

test("lead record shape", () => {
  const a = base({ familiarity: "client", owned: ["dev"], companySize: "enterprise", needs: ["intel"], install: "yes" });
  const lead = F.buildLead(a, { name: " Ana ", email: "ana@x.co", company: "X" }, { now: 1, source: { utm_source: "email" } });
  assert.equal(lead.schema, 2);
  assert.equal(lead.contact.name, "Ana");
  assert.deepEqual(lead.owned, ["dev"]);
  assert.deepEqual(lead.recommendation, { tier: "ultra", reason: "install", products: ["intel", "dev", "social", "apps"], includesInstall: true });
});

test("dashboard reads September prototype rows", () => {
  const legacy = { createdAt: 5, name: "Old", email: "o@x.co", company: "Y", needs: ["intel", "dev", "social", "apps"], recommendation: "ultra", wantsInstall: true };
  const n = F.normalizeLead(legacy);
  assert.equal(n.recommendation.tier, "ultra");
  assert.equal(n.recommendation.includesInstall, true);
  assert.equal(n.contact.name, "Old");
  const s = F.summarize([legacy, F.buildLead(base({ companySize: "solo", needs: ["intel"] }), { name: "N", email: "n@x.co", company: "Z" })]);
  assert.equal(s.total, 2);
  assert.equal(s.ultra, 1);
  assert.equal(s.topNeed, "intel");
  assert.equal(s.warm, 1);
});

test("CSV escapes quotes, commas, and formula injection", () => {
  const lead = F.buildLead(base({ companySize: "solo", needs: ["dev"] }), { name: "=HYPERLINK(\"x\")", email: "a@b.co", company: "A, Inc" }, { now: 0 });
  const csv = F.toCsv([lead]).split("\n");
  assert.equal(csv.length, 2);
  assert.ok(csv[1].includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv[1].includes('"A, Inc"'));
});

test("entry links can preset familiarity and carry UTM tags", () => {
  const e = F.parseEntry("?f=client&utm_source=newsletter&utm_campaign=q4+push&leads");
  assert.equal(e.familiarity, "client");
  assert.deepEqual(e.source, { utm_source: "newsletter", utm_campaign: "q4 push" });
  assert.equal(e.owner, true);
  assert.equal(F.parseEntry("?f=bogus").familiarity, null);
});
