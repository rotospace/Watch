/* Front9 Fit Finder: DOM wiring. All decisions live in logic.js (window.FitFinder). */
(function () {
  "use strict";
  var F = window.FitFinder;
  var P = F.PRODUCTS;

  var entry = F.parseEntry(window.location.search);
  var answers = { familiarity: entry.familiarity, owned: [], needs: [] };
  var path = F.buildPath(answers);
  var current = "welcome";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var screens = {};
  $$(".screen").forEach(function (s) { screens[s.dataset.screen] = s; });
  var progressEl = $("#progress"), progressFill = $("#progressFill");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function setCopy(key, text) { $$('[data-copy="' + key + '"]').forEach(function (n) { n.textContent = text; }); }

  /* ---------- copy that adapts to familiarity ---------- */
  function applyCopy() {
    var w = F.copyFor("welcome", answers);
    setCopy("welcome-eyebrow", w.eyebrow);
    setCopy("welcome-headline", w.headline);
    setCopy("welcome-sub", w.sub);
    setCopy("welcome-cta", w.cta);
    setCopy("size-headline", F.copyFor("sizeHeadline", answers));
    setCopy("needs-headline", F.copyFor("needsHeadline", answers));
    setCopy("needs-sub", F.copyFor("needsSub", answers));
    setCopy("contact-headline", F.copyFor("contactHeadline", answers));
  }

  /* ---------- navigation ---------- */
  function show(name) {
    current = name;
    Object.keys(screens).forEach(function (k) { screens[k].hidden = k !== name; });
    var idx = path.indexOf(name);
    if (idx <= 0 || name === "done") progressEl.hidden = true;
    else {
      progressEl.hidden = false;
      progressFill.style.width = Math.round((idx / (path.length - 1)) * 100) + "%";
    }
    window.scrollTo(0, 0);
    var focusTarget = $("h1, h2", screens[name]);
    if (focusTarget) { focusTarget.setAttribute("tabindex", "-1"); focusTarget.focus({ preventScroll: true }); }
  }
  function next() {
    path = F.buildPath(answers);
    var to = path[path.indexOf(current) + 1];
    if (to === "reveal") renderReveal();
    if (to === "needs") renderNeeds();
    show(to);
  }
  function back() {
    path = F.buildPath(answers);
    var idx = path.indexOf(current);
    show(idx > 0 ? path[idx - 1] : "welcome");
  }

  $$("[data-back]").forEach(function (b) { b.addEventListener("click", back); });
  $('[data-action="start"]').addEventListener("click", function () {
    // A link with ?f= already told us familiarity, so skip asking.
    if (entry.familiarity && current === "welcome") {
      markPill("familiarity", entry.familiarity);
      current = "familiarity";
    }
    next();
  });
  $('[data-action="to-contact"]').addEventListener("click", next);

  /* ---------- single-choice screens ---------- */
  function markPill(field, value) {
    $$('.pillgrid[data-field="' + field + '"] .pill').forEach(function (p) {
      p.classList.toggle("selected", p.dataset.value === value);
    });
  }
  $$(".pillgrid[data-field]").forEach(function (grid) {
    grid.addEventListener("click", function (e) {
      var pill = e.target.closest(".pill");
      if (!pill) return;
      var field = grid.dataset.field;
      answers[field] = pill.dataset.value;
      markPill(field, pill.dataset.value);
      if (field === "familiarity") {
        if (answers.familiarity !== "client") answers.owned = [];
        renderOwned();
        applyCopy();
      }
      setTimeout(next, 160);
    });
  });

  /* ---------- multi-choice screens ---------- */
  function checkcard(key, opts) {
    var b = el("button", "checkcard");
    b.type = "button";
    b.dataset.key = key;
    b.setAttribute("aria-pressed", opts.pressed ? "true" : "false");
    if (opts.disabled) b.disabled = true;
    b.appendChild(el("span", "checkbox", "✓"));
    var t = el("span", "checkcard-text");
    t.appendChild(el("span", "checkcard-title", opts.title));
    if (opts.tag) t.appendChild(el("span", "owned-tag", opts.tag));
    if (opts.desc) t.appendChild(el("span", "checkcard-desc", opts.desc));
    b.appendChild(t);
    return b;
  }

  function renderOwned() {
    var box = $('[data-multi="owned"]');
    box.innerHTML = "";
    F.PRODUCT_KEYS.forEach(function (k) {
      box.appendChild(checkcard(k, { title: P[k].label, desc: P[k].title, pressed: answers.owned.indexOf(k) !== -1 }));
    });
    $('[data-action="owned-continue"]').disabled = answers.owned.length === 0;
  }

  function renderNeeds() {
    var box = $('[data-multi="needs"]');
    var f = answers.familiarity || "basics";
    var own = F.owned(answers);
    answers.needs = answers.needs.filter(function (k) { return own.indexOf(k) === -1; });
    box.innerHTML = "";
    F.PRODUCT_KEYS.forEach(function (k) {
      var has = own.indexOf(k) !== -1;
      box.appendChild(checkcard(k, {
        title: f === "new" ? P[k].title : P[k].label + " · " + P[k].title,
        desc: has ? null : P[k].desc[f],
        tag: has ? "You have this" : null,
        disabled: has,
        pressed: answers.needs.indexOf(k) !== -1
      }));
    });
    $('[data-action="needs-continue"]').disabled = answers.needs.length === 0;
  }

  function wireMulti(field, continueSel) {
    $('[data-multi="' + field + '"]').addEventListener("click", function (e) {
      var card = e.target.closest(".checkcard");
      if (!card || card.disabled) return;
      var list = answers[field], k = card.dataset.key, i = list.indexOf(k);
      if (i === -1) list.push(k); else list.splice(i, 1);
      card.setAttribute("aria-pressed", i === -1 ? "true" : "false");
      $(continueSel).disabled = list.length === 0;
    });
    $(continueSel).addEventListener("click", function () {
      if (field === "needs") answers.install = F.needsInstallQuestion(answers) ? answers.install : undefined;
      next();
    });
  }
  wireMulti("owned", '[data-action="owned-continue"]');
  wireMulti("needs", '[data-action="needs-continue"]');

  /* ---------- result ---------- */
  function productRow(k, why) {
    var row = el("div", "product-row");
    row.appendChild(el("span", "product-check", "✓"));
    var t = el("span");
    t.appendChild(el("span", "product-name", P[k].label));
    t.appendChild(el("span", "product-why", why));
    row.appendChild(t);
    return row;
  }

  function renderReveal() {
    var rec = F.recommend(answers);
    var eyebrow = $("#revealEyebrow"), card = $("#resultCard");
    $("#revealHeadline").textContent = F.revealHeadline(rec, answers);
    card.innerHTML = "";
    var isUltra = rec.tier === "ultra";
    eyebrow.textContent = isUltra ? "Your fit · Front9 Ultra" : "Your fit";
    eyebrow.classList.toggle("ultra", isUltra);
    card.classList.toggle("ultra", isUltra);

    if (isUltra) {
      F.PRODUCT_KEYS.forEach(function (k) {
        var why = rec.owned.indexOf(k) !== -1 ? "You already have this. It rolls into Ultra."
          : answers.needs.indexOf(k) !== -1 ? P[k].why
          : "Included in Ultra, so you're covered as you grow.";
        card.appendChild(productRow(k, why));
      });
      if (rec.includesInstall) {
        card.appendChild(el("div", "install-chip", "+ Enterprise AI corporate install"));
        card.appendChild(el("p", "result-note", "Front9 runs inside your company: your SSO, your data residency rules, your infrastructure."));
      } else if (rec.installInterest === "unsure") {
        card.appendChild(el("p", "result-note", "We'll walk through shared cloud versus a private install on the call, so you don't have to decide now."));
      } else {
        card.appendChild(el("p", "result-note", "Shared cloud works for this. A private enterprise install is available if that changes."));
      }
      if (rec.reason === "scale" && rec.missing.length) {
        card.appendChild(el("p", "result-note", "Prefer to start smaller? " + F.recommendationLabel({ tier: "individual", products: rec.added.length ? rec.added : F.coverage(answers) }) + " on their own works too, and we'll price both."));
      }
    } else {
      rec.products.forEach(function (k) { card.appendChild(productRow(k, P[k].why)); });
      if (rec.missing.length && rec.missing.length < 4) {
        var names = rec.missing.map(function (k) { return P[k].label; });
        card.appendChild(el("p", "result-note", "Front9 Ultra bundles all four at a better rate if you expect to need " + names.join(", ") + " down the line."));
      }
      if (rec.installInterest === "unsure") {
        card.appendChild(el("p", "result-note", "We'll cover shared cloud versus a private install on the call."));
      }
    }
  }

  /* ---------- storage ---------- */
  var store = {
    kind: "local", leads: [], listeners: [],
    add: function (lead) { return Promise.reject(new Error("storage not ready")); },
    emit: function () { var s = this; s.listeners.forEach(function (fn) { fn(s.leads); }); }
  };

  function useLocal() {
    var KEY = "front9-fit-finder-leads";
    store.kind = "local";
    try { store.leads = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { store.leads = []; }
    store.add = function (lead) {
      store.leads = [lead].concat(store.leads);
      try { localStorage.setItem(KEY, JSON.stringify(store.leads.slice(0, 500))); } catch (e) { /* private mode: keep in memory */ }
      store.emit();
      return Promise.resolve();
    };
    store.emit();
  }

  function useEndpoint(url) {
    store.kind = "endpoint";
    store.add = function (lead) {
      return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) })
        .then(function (r) { if (!r.ok) throw new Error("server said " + r.status); });
    };
  }

  function useArtifactDb(db) {
    store.kind = "artifact";
    store.add = function (lead) { return db.collection("leads").add(lead); };
    db.collection("leads").orderBy("createdAt", "desc").limit(500).onSnapshot(function (snap) {
      store.leads = snap.docs.map(function (d) { return d.data(); });
      store.emit();
    }, function () {});
  }

  /* ---------- contact + submit ---------- */
  var form = $('[data-form="contact"]');
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var contact = {};
    ["name", "email", "company", "phone", "note"].forEach(function (k) { contact[k] = form.elements[k].value; });
    var errors = F.validateContact(contact);
    ["name", "email", "company"].forEach(function (k) {
      var msg = $('[data-error-for="' + k + '"]', form);
      msg.hidden = !errors[k];
      msg.textContent = errors[k] || "";
      form.elements[k].setAttribute("aria-invalid", errors[k] ? "true" : "false");
    });
    var first = ["name", "email", "company"].filter(function (k) { return errors[k]; })[0];
    if (first) { form.elements[first].focus(); return; }

    var btn = $('button[type="submit"]', form), err = $("[data-error]", form);
    btn.disabled = true; btn.textContent = "Submitting…"; err.hidden = true;
    var lead = F.buildLead(answers, contact, { source: entry.source });
    store.add(lead).then(function () {
      var rec = F.recommend(answers);
      var firstName = contact.name.trim().split(/\s+/)[0] || "there";
      $("#doneHeadline").textContent = "You're set, " + firstName + ".";
      $("#doneSub").textContent = F.doneSub(rec, answers);
      next();
    }).catch(function (ex) {
      err.textContent = "Couldn't submit: " + (ex && ex.message ? ex.message : "please try again") + ".";
      err.hidden = false;
    }).then(function () { btn.disabled = false; btn.textContent = "Submit"; });
  });

  /* ---------- owner dashboard ---------- */
  var dashboard = $("#dashboard"), ownerToggle = $("#ownerToggle"), appEl = $("#app");
  function chip(k) { return el("span", "chip " + k, P[k] ? P[k].short : k); }

  function renderLeads(leads) {
    var rows = leads.map(F.normalizeLead).filter(Boolean);
    var s = F.summarize(leads);
    $('[data-stat="total"]').textContent = s.total;
    $('[data-stat="warm"]').textContent = s.warm;
    $('[data-stat="ultra"]').textContent = s.ultra;
    $('[data-stat="install"]').textContent = s.install;
    $('[data-stat="topNeed"]').textContent = s.topNeed ? P[s.topNeed].short : "—";
    $('[data-stat="avgNeeds"]').textContent = s.avgNeeds;
    var body = $("#leadsBody");
    body.innerHTML = "";
    $("#leadsEmpty").hidden = rows.length > 0;
    rows.forEach(function (l) {
      var tr = el("tr");
      tr.appendChild(el("td", "mono", new Date(l.createdAt || 0).toLocaleDateString()));
      tr.appendChild(el("td", null, (l.contact.name || "—") + (l.contact.company ? " · " + l.contact.company : "")));
      tr.appendChild(el("td", null, l.contact.email || "—"));
      tr.appendChild(el("td", null, l.companySize || "—"));
      tr.appendChild(el("td", null, (l.familiarity || "—") + (l.owned.length ? " (has " + l.owned.map(function (k) { return P[k].short; }).join(", ") + ")" : "")));
      var needs = el("td");
      l.needs.forEach(function (k) { needs.appendChild(chip(k)); });
      tr.appendChild(needs);
      var recTd = el("td");
      if (l.recommendation.tier === "ultra") recTd.appendChild(el("span", "chip ultra", "Ultra" + (l.recommendation.includesInstall ? " + install" : "")));
      else l.recommendation.products.forEach(function (k) { recTd.appendChild(chip(k)); });
      tr.appendChild(recTd);
      tr.appendChild(el("td", "note", l.contact.note || ""));
      body.appendChild(tr);
    });
  }
  store.listeners.push(renderLeads);

  function openDashboard() {
    $("main").hidden = true; progressEl.hidden = true; ownerToggle.hidden = true;
    dashboard.hidden = false; appEl.classList.add("wide");
    $("#storageNote").textContent = store.kind === "local"
      ? "Demo mode: responses are saved in this browser only. Set FIT_FINDER_CONFIG.endpoint to send them to your CRM."
      : store.kind === "endpoint" ? "Responses are posted to your endpoint, so they aren't listed here." : "";
    renderLeads(store.leads);
  }
  ownerToggle.addEventListener("click", openDashboard);
  $('[data-action="close-dashboard"]').addEventListener("click", function () {
    dashboard.hidden = true; $("main").hidden = false; ownerToggle.hidden = false; appEl.classList.remove("wide");
    show(current);
  });

  $('[data-action="export-csv"]').addEventListener("click", function () {
    var csv = F.toCsv(store.leads);
    var save = window.__fitDownloads;
    if (save) { save.save({ filename: "front9-fit-leads.csv", data: csv }).catch(function () {}); return; }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "front9-fit-leads.csv";
    document.body.appendChild(a); a.click(); a.remove();
  });

  /* ---------- boot ---------- */
  renderOwned();
  applyCopy();
  var cfg = window.FIT_FINDER_CONFIG || {};
  if (window.claude && window.claude.use) {
    Promise.resolve(window.claude.use("db")).then(function (db) { if (db) useArtifactDb(db); else useLocal(); }).catch(useLocal);
    Promise.resolve(window.claude.use("downloads")).then(function (d) { window.__fitDownloads = d; }).catch(function () {});
    Promise.resolve(window.claude.use("user")).then(function (u) {
      if (u) u.isOwner().then(function (own) { ownerToggle.hidden = !own; });
    }).catch(function () {});
  } else if (cfg.endpoint) {
    useEndpoint(cfg.endpoint);
    ownerToggle.hidden = !entry.owner;
  } else {
    useLocal();
    ownerToggle.hidden = !entry.owner;
  }
  show("welcome");
})();
