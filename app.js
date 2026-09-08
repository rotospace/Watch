// Local Prospect Outreach — app logic. Vanilla JS, no build step, no server.
// All state lives in localStorage; nothing leaves the browser.

const STORAGE_KEY = "outreach_app_state_v1";

function uid(prefix) {
  return (prefix ? prefix + "-" : "") + Math.random().toString(36).slice(2, 9);
}

function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || uid();
}

function defaultState() {
  return {
    version: 1,
    sender: { name: "", title: "", company: "", phone: "", email: "", offer: "", proof: "", booking: "" },
    markets: DEFAULT_MARKETS.map((m) => ({ ...m })),
    industries: DEFAULT_INDUSTRIES.map((i) => ({ ...i, custom: false })),
    scriptOverrides: {}, // industryId -> array of {step, subject, body}
    prospects: [], // {id, businessName, ownerFirstName, email, phone, marketId, industryId, signal, notes, sentSteps: [1,2], lastSentAt}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      sender: { ...base.sender, ...(parsed.sender || {}) },
      markets: Array.isArray(parsed.markets) && parsed.markets.length ? parsed.markets : base.markets,
      industries: Array.isArray(parsed.industries) && parsed.industries.length ? parsed.industries : base.industries,
      scriptOverrides: parsed.scriptOverrides || {},
      prospects: Array.isArray(parsed.prospects) ? parsed.prospects : [],
    };
  } catch (e) {
    console.error("Failed to load state, starting fresh.", e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let selectedIndustryId = state.industries[0] ? state.industries[0].id : null;
let selectedStep = 1;
let lastGenerated = []; // [{prospect, subject, body}]
let editingProspectId = null;
let editingMarketId = null;

// ---------- lookups ----------
function getMarket(id) { return state.markets.find((m) => m.id === id); }
function getIndustry(id) { return state.industries.find((i) => i.id === id); }

function marketLabel(m) { return m ? `${m.city} (${m.region})` : "—"; }

function websiteCell(website) {
  if (!website) return document.createTextNode("—");
  const href = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  return el("a", { href, target: "_blank", rel: "noopener noreferrer" }, [website.replace(/^https?:\/\//i, "")]);
}

// ---------- merge/template engine ----------
function buildSignature(sender) {
  const lines = ["Best,"];
  if (sender.name) lines.push(sender.name);
  const titleCompany = [sender.title, sender.company].filter(Boolean).join(", ");
  if (titleCompany) lines.push(titleCompany);
  if (sender.phone) lines.push(sender.phone);
  return lines.join("\n");
}

function buildContext(prospect, sampleFallback) {
  const market = prospect ? getMarket(prospect.marketId) : null;
  const industry = prospect ? getIndustry(prospect.industryId) : null;
  const sender = state.sender;
  const useSample = sampleFallback && !prospect;

  const signal = prospect ? (prospect.signal || "") : (useSample ? "no standalone website, just a Google Business Profile" : "");
  const signalLine = signal ? `Specifically, I noticed ${signal}. ` : "";

  return {
    business_name: prospect ? prospect.businessName : (useSample ? "Sunshine Roofing" : ""),
    owner_first_name: prospect ? (prospect.ownerFirstName || "there") : (useSample ? "Marco" : "there"),
    website: prospect ? (prospect.website || "") : (useSample ? "sunshineroofingfl.com" : "{{website}}"),
    city: market ? market.city : (useSample ? "Miami" : "{{city}}"),
    region: market ? market.region : (useSample ? "South Florida" : "{{region}}"),
    industry_label: industry ? industry.label : (useSample ? "Roofing Contractors" : "{{industry_label}}"),
    pain_hook: industry ? industry.painHook : (useSample ? "storm-season lead spikes and slow follow-up on estimates" : "{{pain_hook}}"),
    your_name: sender.name || "{{your_name}}",
    your_company: sender.company || "{{your_company}}",
    your_offer: sender.offer || "{{your_offer}}",
    proof_point: sender.proof || "{{proof_point}}",
    booking_link: sender.booking || "{{booking_link}}",
    your_phone: sender.phone || "{{your_phone}}",
    signature: buildSignature(sender),
    signal,
    signal_line: signalLine,
  };
}

function mergeTemplate(str, ctx) {
  return String(str || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => {
    return Object.prototype.hasOwnProperty.call(ctx, key) ? ctx[key] : m;
  });
}

function getScriptsForIndustry(industryId) {
  const override = state.scriptOverrides[industryId];
  return SCRIPT_FRAMEWORK.map((step) => {
    const custom = override && override.find((s) => s.step === step.step);
    return custom ? { ...step, subject: custom.subject, body: custom.body } : { ...step };
  });
}

function setScriptOverride(industryId, step, subject, body) {
  if (!state.scriptOverrides[industryId]) state.scriptOverrides[industryId] = [];
  const arr = state.scriptOverrides[industryId];
  const existing = arr.find((s) => s.step === step);
  if (existing) { existing.subject = subject; existing.body = body; }
  else arr.push({ step, subject, body });
  saveState();
}

// ---------- CSV ----------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((v) => v.trim() !== "")).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    return obj;
  });
}

function csvEscape(val) {
  const s = String(val == null ? "" : val);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCSV(rows, columns) {
  const lines = [columns.map(csvEscape).join(",")];
  rows.forEach((r) => lines.push(columns.map((c) => csvEscape(r[c])).join(",")));
  return lines.join("\n");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ==================================================================
// RENDERING
// ==================================================================

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (children || []).forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

function flashSaved() {
  const flag = document.getElementById("setup-saved-flag");
  flag.classList.add("show");
  setTimeout(() => flag.classList.remove("show"), 1400);
}

// Native alert()/confirm() are silently no-ops in a sandboxed iframe (e.g. an
// Artifact preview) with no allow-modals, so validation messages and destructive
// confirmations use these in-page equivalents instead.
let toastTimer = null;
function notify(message, type) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast" + (type === "error" ? " error" : "");
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirm-overlay");
    const okBtn = document.getElementById("confirm-ok");
    const cancelBtn = document.getElementById("confirm-cancel");
    document.getElementById("confirm-message").textContent = message;
    overlay.hidden = false;

    function cleanup(result) {
      overlay.hidden = true;
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }
    function onKeydown(e) { if (e.key === "Escape") cleanup(false); }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeydown);
  });
}

// ---- Setup tab ----
function renderSetup() {
  const s = state.sender;
  document.getElementById("s-name").value = s.name;
  document.getElementById("s-title").value = s.title;
  document.getElementById("s-company").value = s.company;
  document.getElementById("s-phone").value = s.phone;
  document.getElementById("s-email").value = s.email;
  document.getElementById("s-booking").value = s.booking;
  document.getElementById("s-offer").value = s.offer;
  document.getElementById("s-proof").value = s.proof;
  renderMarketChips();
}

function renderMarketChips() {
  const list = document.getElementById("market-list");
  list.innerHTML = "";
  state.markets.forEach((m) => {
    if (m.id === editingMarketId) {
      list.appendChild(buildMarketEditChip(m));
      return;
    }
    const chip = el("span", { class: "chip" }, [
      el("button", { class: "chip-label", title: "Click to edit", onclick: () => { editingMarketId = m.id; renderMarketChips(); } }, [marketLabel(m)]),
      el("button", { class: "chip-remove", title: "Remove", onclick: () => removeMarket(m.id) }, ["✕"]),
    ]);
    list.appendChild(chip);
  });
  refreshMarketSelects();
  refreshRegionSelects();
  refreshRegionDatalist();
}

function buildMarketEditChip(m) {
  const cityInput = el("input", { type: "text", value: m.city });
  const regionInput = el("input", { type: "text", value: m.region, list: "region-datalist" });

  function save() {
    const city = cityInput.value.trim();
    const region = regionInput.value.trim();
    if (!city) { notify("Enter a city/area name.", "error"); return; }
    if (!region) { notify("Enter a region (e.g. Upper Keys).", "error"); return; }
    m.city = city;
    m.region = region;
    editingMarketId = null;
    saveState();
    renderMarketChips();
    renderProspects();
  }

  return el("span", { class: "chip chip-editing" }, [
    cityInput,
    regionInput,
    el("button", { class: "chip-remove", title: "Save", onclick: save }, ["✓"]),
    el("button", { class: "chip-remove", title: "Cancel", onclick: () => { editingMarketId = null; renderMarketChips(); } }, ["✕"]),
  ]);
}

function refreshRegionDatalist() {
  const datalist = document.getElementById("region-datalist");
  if (!datalist) return;
  const regions = Array.from(new Set(state.markets.map((m) => m.region))).sort();
  datalist.innerHTML = "";
  regions.forEach((r) => datalist.appendChild(el("option", { value: r })));
}

function refreshRegionSelects() {
  const targets = ["filter-region", "g-region"];
  const regions = Array.from(new Set(state.markets.map((m) => m.region))).sort();
  targets.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const keepValue = sel.value;
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "" }, [id === "g-region" ? "All regions" : "All"]));
    regions.forEach((r) => sel.appendChild(el("option", { value: r }, [r])));
    if (regions.includes(keepValue)) sel.value = keepValue;
  });
}

async function removeMarket(id) {
  const inUse = state.prospects.some((p) => p.marketId === id);
  if (inUse && !(await confirmDialog("Some prospects use this market. Remove it anyway? (their market will show as unknown)"))) return;
  state.markets = state.markets.filter((m) => m.id !== id);
  saveState();
  renderMarketChips();
  renderProspects();
}

// ---- Scripts tab ----
function populateCategorySelect() {
  const sel = document.getElementById("i-category");
  sel.innerHTML = "";
  INDUSTRY_CATEGORIES.filter((c) => c.id !== "custom").forEach((c) => {
    sel.appendChild(el("option", { value: c.id }, [c.label]));
  });
}

function renderIndustryList() {
  const list = document.getElementById("industry-list");
  list.innerHTML = "";
  INDUSTRY_CATEGORIES.forEach((cat) => {
    const items = state.industries.filter((i) => i.category === cat.id);
    if (!items.length) return;
    list.appendChild(el("div", { class: "industry-group-title" }, [cat.label]));
    items.forEach((ind) => {
      const row = el("div", { class: "industry-row" + (ind.id === selectedIndustryId ? " active" : "") }, [
        el("span", {}, [ind.label]),
        el("button", { class: "del", title: "Delete industry", onclick: (e) => { e.stopPropagation(); removeIndustry(ind.id); } }, ["✕"]),
      ]);
      row.addEventListener("click", () => { selectedIndustryId = ind.id; selectedStep = 1; renderIndustryList(); renderScriptEditor(); });
      list.appendChild(row);
    });
  });
}

async function removeIndustry(id) {
  const inUse = state.prospects.some((p) => p.industryId === id);
  if (inUse && !(await confirmDialog("Some prospects use this industry. Delete it anyway?"))) return;
  state.industries = state.industries.filter((i) => i.id !== id);
  delete state.scriptOverrides[id];
  saveState();
  if (selectedIndustryId === id) selectedIndustryId = state.industries[0] ? state.industries[0].id : null;
  renderIndustryList();
  renderScriptEditor();
  refreshIndustrySelects();
}

function renderScriptEditor() {
  const industry = getIndustry(selectedIndustryId);
  const header = document.getElementById("script-editor-industry");
  header.textContent = industry ? industry.label : "";
  const container = document.getElementById("script-steps");
  container.innerHTML = "";
  if (!industry) {
    container.appendChild(el("p", { class: "empty-state" }, ["Add or select an industry to edit its email sequence."]));
    return;
  }

  const stepTabs = el("div", { class: "step-tabs" });
  SCRIPT_FRAMEWORK.forEach((step) => {
    const btn = el("button", {
      class: "step-tab-btn" + (step.step === selectedStep ? " active" : ""),
      onclick: () => { selectedStep = step.step; renderScriptEditor(); },
    }, [`${step.step}. ${step.name}`]);
    stepTabs.appendChild(btn);
  });
  container.appendChild(stepTabs);

  const scripts = getScriptsForIndustry(industry.id);
  const current = scripts.find((s) => s.step === selectedStep);
  const ctx = buildContext(null, true);

  const subjectInput = el("input", { type: "text", id: "edit-subject", value: current.subject });
  const bodyInput = el("textarea", { id: "edit-body", rows: "10" }, [current.body]);
  bodyInput.value = current.body;

  const preview = el("div", { class: "preview-box" });
  function refreshPreview() {
    preview.innerHTML = "";
    preview.appendChild(el("div", { class: "preview-subject" }, [mergeTemplate(subjectInput.value, ctx)]));
    preview.appendChild(el("div", {}, [mergeTemplate(bodyInput.value, ctx)]));
  }
  refreshPreview();
  subjectInput.addEventListener("input", () => { refreshPreview(); autosave(); });
  bodyInput.addEventListener("input", () => { refreshPreview(); autosave(); });

  let saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      setScriptOverride(industry.id, selectedStep, subjectInput.value, bodyInput.value);
    }, 400);
  }

  const editWrap = el("div", { class: "script-step" }, [
    el("label", {}, ["Subject", subjectInput]),
    el("label", {}, ["Body", bodyInput]),
  ]);
  const previewWrap = el("div", { class: "script-step" }, [
    el("h3", {}, ["Preview (sample prospect: Marco @ Sunshine Roofing, Miami)"]),
    preview,
  ]);
  const fieldsNote = el("div", { class: "merge-fields" }, [
    "Merge fields: ",
    ...["business_name","owner_first_name","website","city","region","industry_label","pain_hook","your_name","your_company","your_offer","proof_point","booking_link","your_phone","signature","signal","signal_line"]
      .map((f) => el("code", {}, [`{{${f}}}`])).flatMap((n, idx, arr) => idx < arr.length - 1 ? [n, document.createTextNode(" ")] : [n]),
  ]);

  container.appendChild(editWrap);
  container.appendChild(fieldsNote);
  container.appendChild(previewWrap);
}

// ---- shared select population ----
function refreshMarketSelects() {
  const targets = ["p-market", "g-market", "filter-market"];
  targets.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const keepValue = sel.value;
    const hasAll = id === "g-market" || id === "filter-market";
    sel.innerHTML = "";
    if (hasAll) sel.appendChild(el("option", { value: "" }, [id === "g-market" ? "All markets" : "All"]));
    state.markets.forEach((m) => sel.appendChild(el("option", { value: m.id }, [marketLabel(m)])));
    if ([...sel.options].some((o) => o.value === keepValue)) sel.value = keepValue;
  });
}

function refreshIndustrySelects() {
  const targets = ["p-industry", "g-industry", "filter-industry"];
  targets.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const keepValue = sel.value;
    const hasAll = id === "g-industry" || id === "filter-industry";
    sel.innerHTML = "";
    if (hasAll) sel.appendChild(el("option", { value: "" }, [id === "g-industry" ? "All industries" : "All"]));
    INDUSTRY_CATEGORIES.forEach((cat) => {
      const items = state.industries.filter((i) => i.category === cat.id);
      if (!items.length) return;
      const group = el("optgroup", { label: cat.label });
      items.forEach((i) => group.appendChild(el("option", { value: i.id }, [i.label])));
      sel.appendChild(group);
    });
    if ([...sel.options].some((o) => o.value === keepValue)) sel.value = keepValue;
  });
}

// ---- Prospects tab ----
function marketOptionEls(selectedId) {
  return state.markets.map((m) => {
    const opt = el("option", { value: m.id }, [marketLabel(m)]);
    if (m.id === selectedId) opt.selected = true;
    return opt;
  });
}

function industryOptionEls(selectedId) {
  const els = [];
  INDUSTRY_CATEGORIES.forEach((cat) => {
    const items = state.industries.filter((i) => i.category === cat.id);
    if (!items.length) return;
    const group = el("optgroup", { label: cat.label });
    items.forEach((i) => {
      const opt = el("option", { value: i.id }, [i.label]);
      if (i.id === selectedId) opt.selected = true;
      group.appendChild(opt);
    });
    els.push(group);
  });
  return els;
}

function renderProspects() {
  document.getElementById("prospect-count").textContent = state.prospects.length;
  const marketFilter = document.getElementById("filter-market").value;
  const industryFilter = document.getElementById("filter-industry").value;
  const regionFilter = document.getElementById("filter-region").value;
  const tbody = document.querySelector("#prospect-table tbody");
  tbody.innerHTML = "";

  const rows = state.prospects.filter((p) => {
    const market = getMarket(p.marketId);
    return (!marketFilter || p.marketId === marketFilter) &&
      (!industryFilter || p.industryId === industryFilter) &&
      (!regionFilter || (market && market.region === regionFilter));
  });

  if (!rows.length) {
    tbody.appendChild(el("tr", {}, [el("td", { colspan: "10", class: "empty-state" }, ["No prospects yet — add one above or import a CSV."])]));
    return;
  }

  rows.forEach((p) => {
    if (p.id === editingProspectId) {
      tbody.appendChild(buildProspectEditRow(p));
      return;
    }
    const market = getMarket(p.marketId);
    const industry = getIndustry(p.industryId);
    const sentText = (p.sentSteps && p.sentSteps.length) ? p.sentSteps.sort().map((s) => "Step " + s).join(", ") : "—";
    tbody.appendChild(el("tr", {}, [
      el("td", {}, [p.businessName || "—"]),
      el("td", {}, [p.ownerFirstName || "—"]),
      el("td", {}, [p.email || "—"]),
      el("td", {}, [p.phone || "—"]),
      el("td", {}, [websiteCell(p.website)]),
      el("td", {}, [market ? marketLabel(market) : "—"]),
      el("td", {}, [industry ? industry.label : "—"]),
      el("td", { class: "signal-cell", title: p.signal || "" }, [p.signal || "—"]),
      el("td", { class: (p.sentSteps && p.sentSteps.length) ? "tag-done" : "tag-empty" }, [sentText]),
      el("td", { class: "row-actions" }, [
        el("button", { class: "btn small secondary", onclick: () => { editingProspectId = p.id; renderProspects(); } }, ["Edit"]),
        el("button", { class: "btn small danger-outline", onclick: () => removeProspect(p.id) }, ["Remove"]),
      ]),
    ]));
  });
}

function buildProspectEditRow(p) {
  const businessInput = el("input", { type: "text", value: p.businessName || "" });
  const ownerInput = el("input", { type: "text", value: p.ownerFirstName || "" });
  const emailInput = el("input", { type: "email", value: p.email || "" });
  const phoneInput = el("input", { type: "text", value: p.phone || "" });
  const websiteInput = el("input", { type: "text", value: p.website || "" });
  const marketSelect = el("select", {}, marketOptionEls(p.marketId));
  const industrySelect = el("select", {}, industryOptionEls(p.industryId));

  function save() {
    if (!businessInput.value.trim() || !emailInput.value.trim()) { notify("Business name and email are required.", "error"); return; }
    p.businessName = businessInput.value.trim();
    p.ownerFirstName = ownerInput.value.trim();
    p.email = emailInput.value.trim();
    p.phone = phoneInput.value.trim();
    p.website = websiteInput.value.trim();
    p.marketId = marketSelect.value;
    p.industryId = industrySelect.value;
    editingProspectId = null;
    saveState();
    renderProspects();
  }

  return el("tr", { class: "editing-row" }, [
    el("td", {}, [businessInput]),
    el("td", {}, [ownerInput]),
    el("td", {}, [emailInput]),
    el("td", {}, [phoneInput]),
    el("td", {}, [websiteInput]),
    el("td", {}, [marketSelect]),
    el("td", {}, [industrySelect]),
    el("td", {}, ["—"]),
    el("td", {}, ["—"]),
    el("td", { class: "row-actions" }, [
      el("button", { class: "btn small", onclick: save }, ["Save"]),
      el("button", { class: "btn small secondary", onclick: () => { editingProspectId = null; renderProspects(); } }, ["Cancel"]),
    ]),
  ]);
}

function removeProspect(id) {
  state.prospects = state.prospects.filter((p) => p.id !== id);
  if (editingProspectId === id) editingProspectId = null;
  saveState();
  renderProspects();
}

function addProspectFromForm() {
  const business = document.getElementById("p-business").value.trim();
  const owner = document.getElementById("p-owner").value.trim();
  const email = document.getElementById("p-email").value.trim();
  const website = document.getElementById("p-website").value.trim();
  const marketId = document.getElementById("p-market").value;
  const industryId = document.getElementById("p-industry").value;
  const signal = document.getElementById("p-signal").value.trim();
  if (!business || !email) { notify("Business name and email are required.", "error"); return; }
  state.prospects.push({ id: uid("p"), businessName: business, ownerFirstName: owner, email, phone: "", website, marketId, industryId, signal, sentSteps: [] });
  saveState();
  document.getElementById("p-business").value = "";
  document.getElementById("p-owner").value = "";
  document.getElementById("p-email").value = "";
  document.getElementById("p-website").value = "";
  document.getElementById("p-signal").value = "";
  renderProspects();
}

function findOrCreateMarketByCity(cityRaw, regionRaw) {
  if (!cityRaw) return state.markets[0] ? state.markets[0].id : "";
  const city = cityRaw.trim();
  const existing = state.markets.find((m) => m.city.toLowerCase() === city.toLowerCase());
  if (existing) return existing.id;
  const region = (regionRaw || "").trim() || "South Florida";
  const m = { id: slugify(city), region, city };
  state.markets.push(m);
  return m.id;
}

function findOrCreateIndustryByName(nameRaw) {
  if (!nameRaw) return state.industries[0] ? state.industries[0].id : "";
  const name = nameRaw.trim();
  const existing = state.industries.find((i) => i.label.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const ind = { id: slugify(name), category: "custom", label: name, painHook: "slow lead follow-up and inconsistent local visibility", custom: true };
  state.industries.push(ind);
  return ind.id;
}

function importCSV(text) {
  const rows = parseCSV(text);
  let count = 0;
  rows.forEach((r) => {
    if (!r.business_name && !r.email) return;
    const marketId = findOrCreateMarketByCity(r.city, r.region);
    const industryId = findOrCreateIndustryByName(r.industry);
    state.prospects.push({
      id: uid("p"),
      businessName: r.business_name || "",
      ownerFirstName: r.owner_first_name || "",
      email: r.email || "",
      phone: r.phone || "",
      website: r.website || "",
      marketId, industryId,
      signal: r.signal || "",
      sentSteps: [],
    });
    count++;
  });
  saveState();
  renderMarketChips();
  renderIndustryList();
  refreshIndustrySelects();
  renderProspects();
  document.getElementById("import-result").textContent = `Imported ${count} prospect${count === 1 ? "" : "s"}.`;
}

// ---- Generate & Send tab ----
function generateEmails() {
  const marketId = document.getElementById("g-market").value;
  const industryId = document.getElementById("g-industry").value;
  const regionId = document.getElementById("g-region").value;
  const step = Number(document.getElementById("g-step").value);
  const onlyShow = document.getElementById("g-onlyshow").value;

  const matches = state.prospects.filter((p) => {
    const market = getMarket(p.marketId);
    return (!marketId || p.marketId === marketId) &&
      (!industryId || p.industryId === industryId) &&
      (!regionId || (market && market.region === regionId)) &&
      (onlyShow === "all" || !(p.sentSteps || []).includes(step));
  });

  lastGenerated = matches.map((p) => {
    const industry = getIndustry(p.industryId) || state.industries[0];
    const scripts = getScriptsForIndustry(industry ? industry.id : null);
    const template = scripts.find((s) => s.step === step) || scripts[0];
    const ctx = buildContext(p, false);
    return {
      prospect: p,
      subject: mergeTemplate(template.subject, ctx),
      body: mergeTemplate(template.body, ctx),
      step,
    };
  });

  document.getElementById("generate-count").textContent =
    lastGenerated.length ? `${lastGenerated.length} email${lastGenerated.length === 1 ? "" : "s"} ready.` : "No matching prospects.";
  renderGenerated();
}

function renderGenerated() {
  const container = document.getElementById("generated-list");
  container.innerHTML = "";
  if (!lastGenerated.length) {
    container.appendChild(el("p", { class: "empty-state" }, ["Set filters above and click Generate."]));
    return;
  }
  lastGenerated.forEach((g) => {
    const market = getMarket(g.prospect.marketId);
    const industry = getIndustry(g.prospect.industryId);
    const already = (g.prospect.sentSteps || []).includes(g.step);

    const card = el("div", { class: "generated-card" });
    card.appendChild(el("div", { class: "generated-head" }, [
      el("div", {}, [
        el("div", { class: "who" }, [`${g.prospect.businessName} — ${g.prospect.email}`]),
        el("div", { class: "meta" }, [`${market ? marketLabel(market) : "No market"} · ${industry ? industry.label : "No industry"} · Step ${g.step}`]),
      ]),
      el("div", { class: "generated-actions" }, [
        el("button", { class: "btn small secondary", onclick: () => copyEmail(g) }, ["Copy"]),
        el("button", {
          class: "btn small" + (already ? " secondary" : ""),
          onclick: () => toggleMarkSent(g),
        }, [already ? "Sent ✓" : "Mark as sent"]),
      ]),
    ]));
    card.appendChild(el("div", { class: "preview-box" }, [
      el("div", { class: "preview-subject" }, [g.subject]),
      el("div", {}, [g.body]),
    ]));
    container.appendChild(card);
  });
}

function copyEmail(g) {
  const text = `Subject: ${g.subject}\n\n${g.body}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* ignore */ }
  ta.remove();
}

function toggleMarkSent(g) {
  const p = g.prospect;
  p.sentSteps = p.sentSteps || [];
  const idx = p.sentSteps.indexOf(g.step);
  if (idx === -1) { p.sentSteps.push(g.step); p.lastSentAt = new Date().toISOString(); }
  else p.sentSteps.splice(idx, 1);
  saveState();
  renderGenerated();
  renderProspects();
}

function exportGeneratedCSV() {
  if (!lastGenerated.length) { notify("Generate emails first.", "error"); return; }
  const rows = lastGenerated.map((g) => ({
    to_email: g.prospect.email,
    business_name: g.prospect.businessName,
    owner_first_name: g.prospect.ownerFirstName,
    subject: g.subject,
    body: g.body,
  }));
  const csv = toCSV(rows, ["to_email", "business_name", "owner_first_name", "subject", "body"]);
  downloadFile(`outreach-step${lastGenerated[0].step}-${Date.now()}.csv`, csv, "text/csv");
}

// ==================================================================
// EVENTS
// ==================================================================

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function wireSetup() {
  document.getElementById("save-setup").addEventListener("click", () => {
    state.sender = {
      name: document.getElementById("s-name").value.trim(),
      title: document.getElementById("s-title").value.trim(),
      company: document.getElementById("s-company").value.trim(),
      phone: document.getElementById("s-phone").value.trim(),
      email: document.getElementById("s-email").value.trim(),
      booking: document.getElementById("s-booking").value.trim(),
      offer: document.getElementById("s-offer").value.trim(),
      proof: document.getElementById("s-proof").value.trim(),
    };
    saveState();
    flashSaved();
    renderScriptEditor();
  });

  document.getElementById("fill-f9a-defaults").addEventListener("click", () => {
    document.getElementById("s-name").value = "Jason Reuter";
    document.getElementById("s-title").value = "Founder";
    document.getElementById("s-company").value = "Front9 AI";
    document.getElementById("s-phone").value = "(305) 537-6861";
    document.getElementById("s-booking").value = "www.f9a.co";
    document.getElementById("s-offer").value =
      "running a free AI-powered signal check on local businesses' online presence — what's working, what's missing, and what to fix first";
    document.getElementById("s-proof").value =
      "No case studies to share yet — but your free signal check will show exactly what's affecting your visibility right now, no cost and no commitment.";
    notify("Filled in Front9 AI defaults — review before Save.");
  });

  document.getElementById("add-market").addEventListener("click", () => {
    const region = document.getElementById("m-region").value.trim() || "South Florida";
    const city = document.getElementById("m-city").value.trim();
    if (!city) { notify("Enter a city/area name.", "error"); return; }
    if (state.markets.some((m) => m.city.toLowerCase() === city.toLowerCase())) {
      notify(`${city} already exists — click its chip below to edit the region instead.`, "error");
      return;
    }
    state.markets.push({ id: slugify(city), region, city });
    saveState();
    document.getElementById("m-city").value = "";
    document.getElementById("m-region").value = "";
    renderMarketChips();
  });

  document.getElementById("export-json").addEventListener("click", () => {
    downloadFile(`outreach-backup-${Date.now()}.json`, JSON.stringify(state, null, 2), "application/json");
  });

  document.getElementById("import-json").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = { ...defaultState(), ...parsed };
        saveState();
        renderAll();
        notify("Backup imported.");
      } catch (err) {
        notify("Could not read that file as a valid backup.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
}

function wireScripts() {
  document.getElementById("add-industry").addEventListener("click", () => {
    const label = document.getElementById("i-label").value.trim();
    const category = document.getElementById("i-category").value;
    const painHook = document.getElementById("i-painhook").value.trim() || "slow lead follow-up and inconsistent local visibility";
    if (!label) { notify("Enter an industry name.", "error"); return; }
    const id = slugify(label);
    if (state.industries.some((i) => i.id === id)) { notify("That industry already exists.", "error"); return; }
    state.industries.push({ id, category, label, painHook, custom: true });
    saveState();
    document.getElementById("i-label").value = "";
    document.getElementById("i-painhook").value = "";
    selectedIndustryId = id;
    selectedStep = 1;
    renderIndustryList();
    renderScriptEditor();
    refreshIndustrySelects();
  });

  document.getElementById("reset-scripts").addEventListener("click", async () => {
    if (!selectedIndustryId) return;
    if (!(await confirmDialog("Reset all 3 scripts for this industry to the default framework?"))) return;
    delete state.scriptOverrides[selectedIndustryId];
    saveState();
    renderScriptEditor();
  });
}

function wireProspects() {
  document.getElementById("add-prospect").addEventListener("click", addProspectFromForm);

  document.getElementById("import-csv").addEventListener("click", () => {
    const text = document.getElementById("csv-input").value;
    if (!text.trim()) { notify("Paste CSV text or upload a file first.", "error"); return; }
    importCSV(text);
  });

  document.getElementById("csv-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById("csv-input").value = reader.result;
      importCSV(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("filter-market").addEventListener("change", renderProspects);
  document.getElementById("filter-industry").addEventListener("change", renderProspects);
  document.getElementById("filter-region").addEventListener("change", renderProspects);
}

function wireSend() {
  document.getElementById("generate-btn").addEventListener("click", generateEmails);
  document.getElementById("export-csv-btn").addEventListener("click", exportGeneratedCSV);
}

function renderAll() {
  renderSetup();
  populateCategorySelect();
  refreshMarketSelects();
  refreshIndustrySelects();
  renderIndustryList();
  renderScriptEditor();
  renderProspects();
  lastGenerated = [];
  renderGenerated();
}

document.addEventListener("DOMContentLoaded", () => {
  wireTabs();
  wireSetup();
  wireScripts();
  wireProspects();
  wireSend();
  renderAll();
});
