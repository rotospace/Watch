/*
 * Front9 Fit Finder: flow + recommendation logic.
 *
 * Pure functions only (no DOM), so the same file runs in the browser
 * (window.FitFinder) and under `node --test` (module.exports).
 * See SPEC.md for the rules these functions implement.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FitFinder = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PRODUCT_KEYS = ["intel", "dev", "social", "apps"];

  var PRODUCTS = {
    intel: {
      label: "Front9 Intel",
      short: "Intel",
      title: "Competitive Intel",
      desc: {
        new: "We watch your competitors for you: their pricing, their reviews, and whether AI search tools like ChatGPT recommend them over you. You get it as a recurring Front9 Score report.",
        basics: "Competitor pricing, reviews, and AI-search visibility in a recurring Front9 Score report.",
        client: "Add the recurring Front9 Score report on competitors and AI-search visibility."
      },
      why: "You want to see where you stand against competitors on price, reviews, and AI search."
    },
    dev: {
      label: "Front9 Dev",
      short: "Dev",
      title: "Web & App Development",
      desc: {
        new: "We design and build your website, landing pages, or web app, and keep it running.",
        basics: "Build or rebuild your website, landing pages, or web applications.",
        client: "Add a site rebuild, new landing pages, or a web app."
      },
      why: "You need a website, landing pages, or a web app built or rebuilt."
    },
    social: {
      label: "Front9 Social",
      short: "Social",
      title: "Social Management",
      desc: {
        new: "We plan, make, and post your social content on every channel, so nobody on your team has to.",
        basics: "Plan, create, and post social content across channels, done for you.",
        client: "Hand us your social calendar: planning, content, and posting."
      },
      why: "You want social content planned, made, and posted without your team doing it."
    },
    apps: {
      label: "Front9 Apps",
      short: "Apps",
      title: "Custom Software",
      desc: {
        new: "Software built for how you work: internal tools, automations, or apps your customers use.",
        basics: "Internal tools, automations, or customer-facing apps beyond a website.",
        client: "Add internal tools, automations, or a customer-facing app."
      },
      why: "You need software beyond a website: internal tools, automations, or customer apps."
    }
  };

  var FAMILIARITY = ["new", "basics", "client"];
  var COMPANY_SIZES = ["solo", "growing", "multi", "enterprise"];
  var INSTALL = ["yes", "no", "unsure"];

  /* Copy that changes with how well the visitor knows Front9. */
  var COPY = {
    welcome: {
      default: {
        eyebrow: "Front9 · Fit Finder",
        headline: "Which Front9 products actually fit your business?",
        sub: "Answer a few quick questions and see what fits. It takes about a minute.",
        cta: "Start"
      },
      new: {
        eyebrow: "Front9 · Fit Finder",
        headline: "Find out what Front9 can take off your plate.",
        sub: "Front9 handles four things for growing businesses: competitor tracking, websites and apps, social media, and custom software. Answer a few quick questions and we'll tell you which ones fit. No sales call needed to see your result.",
        cta: "Start"
      },
      basics: {
        eyebrow: "Front9 · Fit Finder",
        headline: "Which Front9 products fit you right now?",
        sub: "Intel, Dev, Social, Apps, or all four as Ultra. A minute of questions gets you a straight answer.",
        cta: "Start"
      },
      client: {
        eyebrow: "Front9 · For clients",
        headline: "Ready to get more out of Front9?",
        sub: "Tell us what you already have and what's next, and we'll show you what to add, or whether moving to Ultra saves you money.",
        cta: "Let's go"
      }
    },
    sizeHeadline: {
      new: "How big is your business?",
      basics: "What's the shape of your organization?",
      client: "Has your team size changed? Pick what's true today."
    },
    needsHeadline: {
      new: "What would you like help with?",
      basics: "Which of these are active priorities right now?",
      client: "What do you want to add?"
    },
    needsSub: {
      new: "Pick everything that sounds useful. Most businesses pick more than one.",
      basics: "Pick as many as apply.",
      client: "Products you already have are marked. Pick what you'd like to add."
    },
    contactHeadline: {
      new: "Where should we send your fit report?",
      basics: "Where should we send the proposal?",
      client: "Confirm where your account lead should reach you."
    },
    doneSub: {
      new: "We'll email your fit report about {rec} and a short walkthrough within one business day. No pressure, and no long sales cycle.",
      basics: "We'll follow up about {rec} within one business day.",
      client: "Your account lead will reach out about {rec} within one business day."
    }
  };

  function fam(answers) {
    return FAMILIARITY.indexOf(answers && answers.familiarity) !== -1 ? answers.familiarity : "basics";
  }

  function copyFor(key, answers) {
    var block = COPY[key];
    if (!block) return "";
    if (key === "welcome") {
      var f = answers && answers.familiarity;
      return block[f] || block.default;
    }
    return block[fam(answers)];
  }

  function owned(answers) {
    if (!answers || answers.familiarity !== "client") return [];
    return (answers.owned || []).filter(function (k) { return PRODUCT_KEYS.indexOf(k) !== -1; });
  }

  /* Everything the visitor would have after this purchase: what they own plus what they picked. */
  function coverage(answers) {
    var set = owned(answers).slice();
    (answers.needs || []).forEach(function (k) {
      if (PRODUCT_KEYS.indexOf(k) !== -1 && set.indexOf(k) === -1) set.push(k);
    });
    return PRODUCT_KEYS.filter(function (k) { return set.indexOf(k) !== -1; });
  }

  /* The install question is asked of large orgs, and of anyone heading to Ultra anyway. */
  function needsInstallQuestion(answers) {
    var size = answers.companySize;
    var cov = coverage(answers).length;
    if (size === "enterprise") return true;
    if (cov === 4) return true;
    if (size === "multi" && cov >= 3) return true;
    return false;
  }

  function buildPath(answers) {
    var path = ["welcome", "familiarity"];
    if (answers.familiarity === "client") path.push("owned");
    path.push("companySize", "needs");
    if (needsInstallQuestion(answers)) path.push("install");
    path.push("reveal", "contact", "done");
    return path;
  }

  /*
   * Ultra rules (SPEC.md, "Recommendation"):
   *   1. Wants a dedicated/private install          -> Ultra + enterprise install
   *   2. Would end up with all four products         -> Ultra
   *   3. Multi-location/enterprise and 3 of 4         -> Ultra (recommended, with à la carte shown as the alternative)
   *   otherwise                                      -> the individual products they picked
   *
   * OPEN QUESTION: rule 1 assumes the enterprise AI corporate install is only
   * sold as part of Ultra. If it can be sold on its own, rule 1 should instead
   * add the install to whatever individual products were picked.
   */
  function recommend(answers) {
    var cov = coverage(answers);
    var own = owned(answers);
    var picked = (answers.needs || []).filter(function (k) {
      return PRODUCT_KEYS.indexOf(k) !== -1 && own.indexOf(k) === -1;
    });
    var bigOrg = answers.companySize === "multi" || answers.companySize === "enterprise";
    var install = answers.install === "yes";

    var tier = "individual";
    var reason = "picked";
    if (install) { tier = "ultra"; reason = "install"; }
    else if (cov.length === 4) { tier = "ultra"; reason = "all-four"; }
    else if (bigOrg && cov.length === 3) { tier = "ultra"; reason = "scale"; }

    var missing = PRODUCT_KEYS.filter(function (k) { return cov.indexOf(k) === -1; });

    return {
      tier: tier,
      reason: reason,
      products: tier === "ultra" ? PRODUCT_KEYS.slice() : PRODUCT_KEYS.filter(function (k) { return picked.indexOf(k) !== -1; }),
      added: PRODUCT_KEYS.filter(function (k) { return picked.indexOf(k) !== -1; }),
      owned: own,
      missing: missing,
      includesInstall: install,
      installInterest: answers.install || null,
      upgrade: tier === "ultra" && own.length > 0
    };
  }

  function revealHeadline(rec, answers) {
    var f = fam(answers);
    if (rec.tier === "ultra") {
      if (rec.upgrade) return "Time to move to Ultra.";
      if (rec.reason === "install") return "You're an Ultra fit, built to run inside your company.";
      if (rec.reason === "all-four") return f === "new" ? "You'd use all of it. That's Ultra." : "You're an Ultra fit: you need everything.";
      return "You're an Ultra fit at your scale.";
    }
    if (rec.products.length === 0) return "You're covered for now.";
    if (f === "client") return rec.products.length === 1 ? "One thing to add." : "Here's what to add.";
    return rec.products.length === 1 ? "One clear fit." : "Here's what fits.";
  }

  function recommendationLabel(rec) {
    if (rec.tier === "ultra") return "Front9 Ultra" + (rec.includesInstall ? " with the enterprise install" : "");
    if (!rec.products.length) return "your Front9 setup";
    var names = rec.products.map(function (k) { return PRODUCTS[k].label; });
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }

  function doneSub(rec, answers) {
    return copyFor("doneSub", answers).replace("{rec}", recommendationLabel(rec));
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateContact(c) {
    var errors = {};
    if (!c.name || !c.name.trim()) errors.name = "Add your name.";
    if (!c.email || !EMAIL_RE.test(c.email.trim())) errors.email = "Add a valid work email.";
    if (!c.company || !c.company.trim()) errors.company = "Add your company.";
    return errors;
  }

  /* The record saved for each submission. Schema version lets the dashboard read old rows. */
  function buildLead(answers, contact, meta) {
    var rec = recommend(answers);
    meta = meta || {};
    return {
      schema: 2,
      createdAt: meta.now || Date.now(),
      source: meta.source || {},
      familiarity: answers.familiarity || null,
      owned: owned(answers),
      companySize: answers.companySize || null,
      needs: (answers.needs || []).slice(),
      installInterest: answers.install || null,
      recommendation: {
        tier: rec.tier,
        reason: rec.reason,
        products: rec.products,
        includesInstall: rec.includesInstall
      },
      contact: {
        name: (contact.name || "").trim(),
        email: (contact.email || "").trim(),
        company: (contact.company || "").trim(),
        phone: (contact.phone || "").trim(),
        note: (contact.note || "").trim()
      }
    };
  }

  /* Reads both this schema and the September prototype's flat rows. */
  function normalizeLead(l) {
    if (!l) return null;
    if (l.schema === 2) return l;
    var legacyUltra = l.recommendation === "ultra";
    return {
      schema: 1,
      createdAt: l.createdAt || 0,
      source: {},
      familiarity: l.familiarity || null,
      owned: [],
      companySize: l.companySize || null,
      needs: l.needs || [],
      installInterest: l.wantsInstall ? "yes" : null,
      recommendation: {
        tier: legacyUltra ? "ultra" : "individual",
        reason: legacyUltra ? (l.wantsInstall ? "install" : "all-four") : "picked",
        products: legacyUltra ? PRODUCT_KEYS.slice() : (l.recommendation || []),
        includesInstall: !!l.wantsInstall
      },
      contact: { name: l.name || "", email: l.email || "", company: l.company || "", phone: l.phone || "", note: l.note || "" }
    };
  }

  function summarize(leads) {
    var rows = leads.map(normalizeLead).filter(Boolean);
    var counts = { intel: 0, dev: 0, social: 0, apps: 0 };
    var needsTotal = 0, ultra = 0, install = 0, warm = 0;
    rows.forEach(function (l) {
      if (l.recommendation.tier === "ultra") ultra++;
      if (l.recommendation.includesInstall) install++;
      if (l.familiarity === "basics" || l.familiarity === "client") warm++;
      l.needs.forEach(function (n) { if (counts[n] !== undefined) { counts[n]++; needsTotal++; } });
    });
    var top = PRODUCT_KEYS.slice().sort(function (a, b) { return counts[b] - counts[a]; })[0];
    return {
      total: rows.length,
      ultra: ultra,
      install: install,
      warm: warm,
      topNeed: rows.length && counts[top] > 0 ? top : null,
      avgNeeds: rows.length ? Math.round((needsTotal / rows.length) * 10) / 10 : 0,
      needCounts: counts
    };
  }

  var CSV_COLS = ["createdAt", "name", "email", "company", "phone", "familiarity", "owned", "companySize", "needs", "installInterest", "tier", "products", "includesInstall", "note", "utm_source", "utm_campaign"];

  function csvCell(v) {
    if (v == null) v = "";
    if (Array.isArray(v)) v = v.join("|");
    v = String(v);
    // Neutralize spreadsheet formulas in user-entered text.
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    v = v.replace(/"/g, '""');
    return /[,"\n\r]/.test(v) ? '"' + v + '"' : v;
  }

  function toCsv(leads) {
    var rows = leads.map(normalizeLead).filter(Boolean).map(function (l) {
      var flat = {
        createdAt: new Date(l.createdAt).toISOString(),
        name: l.contact.name, email: l.contact.email, company: l.contact.company,
        phone: l.contact.phone, note: l.contact.note,
        familiarity: l.familiarity, owned: l.owned, companySize: l.companySize,
        needs: l.needs, installInterest: l.installInterest,
        tier: l.recommendation.tier, products: l.recommendation.products,
        includesInstall: l.recommendation.includesInstall,
        utm_source: (l.source || {}).utm_source, utm_campaign: (l.source || {}).utm_campaign
      };
      return CSV_COLS.map(function (c) { return csvCell(flat[c]); }).join(",");
    });
    return [CSV_COLS.join(",")].concat(rows).join("\n");
  }

  /* ?f=client / ?f=new / ?f=basics lets a link pre-set familiarity (e.g. client emails). */
  function parseEntry(search) {
    var params = {};
    (search || "").replace(/^\?/, "").split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("=");
      var k = decodeURIComponent(i === -1 ? pair : pair.slice(0, i));
      var v = i === -1 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
      params[k] = v;
    });
    var source = {};
    ["utm_source", "utm_medium", "utm_campaign", "ref"].forEach(function (k) {
      if (params[k]) source[k] = params[k].slice(0, 120);
    });
    return {
      familiarity: FAMILIARITY.indexOf(params.f) !== -1 ? params.f : null,
      source: source,
      owner: Object.prototype.hasOwnProperty.call(params, "leads")
    };
  }

  return {
    PRODUCT_KEYS: PRODUCT_KEYS,
    PRODUCTS: PRODUCTS,
    FAMILIARITY: FAMILIARITY,
    COMPANY_SIZES: COMPANY_SIZES,
    INSTALL: INSTALL,
    copyFor: copyFor,
    owned: owned,
    coverage: coverage,
    needsInstallQuestion: needsInstallQuestion,
    buildPath: buildPath,
    recommend: recommend,
    revealHeadline: revealHeadline,
    recommendationLabel: recommendationLabel,
    doneSub: doneSub,
    validateContact: validateContact,
    buildLead: buildLead,
    normalizeLead: normalizeLead,
    summarize: summarize,
    toCsv: toCsv,
    parseEntry: parseEntry
  };
});
