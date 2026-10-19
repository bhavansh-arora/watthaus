/* Watthaus solar planner — a branching, resumable quote funnel. */
(() => {
  "use strict";
  window.WH = window.WH || {};
  // main.js calls this after swapping the planner in; on a direct load the
  // planner starts itself at the bottom of this file.
  window.WH.initQuote = function initQuote() {
  const root = document.querySelector("[data-quote]");
  if (!root || root.dataset.ready) return;
  root.dataset.ready = "1";
  const WH = window.WH;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const KEY = "wh-quote-v1";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = WH.fmt;

  /* ------------------------------------------------------------------
     Steps
     ------------------------------------------------------------------ */
  const REGIONS = ["Northland", "Auckland", "Waikato", "Bay of Plenty", "Gisborne", "Hawke's Bay", "Taranaki", "Manawatū-Whanganui", "Wellington", "Nelson & Tasman", "Marlborough", "West Coast", "Canterbury", "Otago", "Southland"];

  const STEPS = {
    path: {
      type: "single", big: true, label: "Project",
      kicker: "Let's start", title: "What are you looking to <em>power?</em>",
      sub: "Pick the one that fits best. We'll tailor the rest of the questions to you.",
      options: [
        { v: "home", label: "My home", desc: "Rooftop solar and batteries for your house", icon: "home" },
        { v: "business", label: "My business", desc: "Commercial rooftops, warehouses and farms", icon: "building" },
        { v: "land", label: "Land or a project", desc: "Utility-scale solar, land and investment", icon: "land" }
      ]
    },
    property: {
      type: "single", label: "Home",
      kicker: "Your home", title: "What kind of home is it?",
      sub: "This helps us plan access, scaffolding and cable runs.",
      options: [
        { v: "Standalone house", desc: "Single or double storey", icon: "home" },
        { v: "Multi-level home", desc: "Three levels or split-level", icon: "building" },
        { v: "Townhouse or unit", desc: "Shared walls or body corporate", icon: "users" },
        { v: "Lifestyle block", desc: "Rural, with room to grow", icon: "land" }
      ]
    },
    bill: {
      type: "range", label: "Power bill", min: 100, max: 800, step: 10, def: 250,
      kicker: "Your usage", title: "Roughly what's your <em>monthly</em> power bill?",
      sub: "An average across the year is perfect. Winter and summer bills both count.",
      fieldLabel: "Average monthly bill",
      show: (v, max) => `$${fmt(v)}${v >= max ? "+" : ""}/mo`
    },
    roof: {
      type: "single", label: "Roof",
      kicker: "Your roof", title: "What's your roof made of?",
      sub: "Standard pricing is based on corrugated iron. Other roofs are fine, they just need different mounting.",
      options: [
        { v: "Corrugated iron", desc: "Standard pricing", icon: "panel" },
        { v: "Tile", desc: "Concrete or clay", icon: "home" },
        { v: "Decramastic", desc: "Pressed-metal tiles", icon: "home" },
        { v: "Membrane or flat", desc: "Low pitch", icon: "building" },
        { v: "Not sure", desc: "We'll check from aerial imagery", icon: "question" }
      ]
    },
    priorities: {
      type: "multi", label: "Priorities",
      kicker: "What matters most", title: "What do you want solar to <em>do for you?</em>",
      sub: "Choose as many as you like.",
      options: [
        { v: "bills", label: "Cut my power bills", desc: "Use more of my own sun", icon: "dollar" },
        { v: "backup", label: "Backup in outages", desc: "Keep the lights on", icon: "shield" },
        { v: "night", label: "Solar power at night", desc: "Store it for the evening peak", icon: "battery" },
        { v: "ev", label: "Charge an EV", desc: "Now or in the next few years", icon: "car" },
        { v: "value", label: "Add property value", desc: "Future-proof the home", icon: "chart" }
      ]
    },
    timing: {
      type: "single", label: "Timing",
      kicker: "Timing", title: "When would you like to <em>switch on?</em>",
      sub: "No wrong answers. Plenty of people start by researching.",
      options: [
        { v: "As soon as possible", icon: "bolt" },
        { v: "Within 3 months", icon: "calendar" },
        { v: "3–6 months", icon: "clock" },
        { v: "Just researching", icon: "search" }
      ]
    },
    result: { type: "result", label: "Plan", kicker: "Your indicative plan", next: "Book my free assessment" },
    details: { type: "details", label: "Details", next: "Confirm my booking" },
    btype: {
      type: "single", label: "Business",
      kicker: "Your business", title: "What kind of site is it?",
      sub: "We'll model your load profile around how the site actually runs.",
      options: [
        { v: "Office or commercial", icon: "building" },
        { v: "Warehouse or industrial", icon: "ship" },
        { v: "Farm or agricultural", icon: "land" },
        { v: "Retail or hospitality", icon: "users" },
        { v: "Something else", icon: "question" }
      ]
    },
    bbill: {
      type: "range", label: "Power bill", min: 500, max: 10000, step: 100, def: 2000,
      kicker: "Your usage", title: "About how much is your <em>monthly</em> power bill?",
      sub: "A rough figure is fine. We'll refine it with your interval data later.",
      fieldLabel: "Average monthly bill",
      show: (v, max) => `$${fmt(v)}${v >= max ? "+" : ""}/mo`
    },
    roofsize: {
      type: "single", label: "Roof area",
      kicker: "Your roof", title: "How much usable roof space is there?",
      sub: "Best guess. North-facing space is the most valuable.",
      options: [
        { v: "Under 200 m²", icon: "panel" }, { v: "200–500 m²", icon: "panel" },
        { v: "500–1,000 m²", icon: "panel" }, { v: "1,000 m² +", icon: "panel" }, { v: "Not sure", icon: "question" }
      ]
    },
    role: {
      type: "single", label: "You are",
      kicker: "About you", title: "Which best describes <em>you?</em>",
      sub: "We work with landowners, investors and developers at every stage.",
      options: [
        { v: "Landowner", desc: "I have land that could host solar", icon: "land" },
        { v: "Developer", desc: "I'm developing a solar project", icon: "hardhat" },
        { v: "Investor", desc: "I'm looking for bankable projects", icon: "chart" },
        { v: "Something else", desc: "Council, iwi, partner or other", icon: "users" }
      ]
    },
    size: {
      type: "single", label: "Land size",
      kicker: "The site", title: "How much land are we talking about?",
      sub: "Roughly 1.5–2 hectares hosts about 1 MW of solar.",
      options: [
        { v: "Under 10 ha", icon: "land" }, { v: "10–50 ha", icon: "land" },
        { v: "50–200 ha", icon: "land" }, { v: "200 ha +", icon: "land" }, { v: "No site yet", icon: "search" }
      ]
    },
    region: {
      type: "chips", label: "Region", options: REGIONS,
      kicker: "Location", title: "Where in Aotearoa is it?",
      sub: "Pick the closest region."
    },
    grid: {
      type: "single", label: "Grid",
      kicker: "Grid connection", title: "Is it close to power lines or a substation?",
      sub: "Grid proximity is one of the biggest drivers of project viability.",
      options: [
        { v: "Yes, close by", desc: "Lines or a substation within a few km", icon: "plug" },
        { v: "Not sure", desc: "We'll run a network capacity check", icon: "question" },
        { v: "No, it's remote", desc: "Still worth a look", icon: "land" }
      ]
    },
    stage: {
      type: "single", label: "Stage",
      kicker: "Where you're at", title: "What stage is the project at?",
      sub: "We can come in at any point, from first look to construction.",
      options: [
        { v: "Exploring options", icon: "search" }, { v: "Feasibility underway", icon: "compass" },
        { v: "Consented or ready to build", icon: "hardhat" }, { v: "Looking to invest", icon: "chart" }
      ]
    },
    done: { type: "done" }
  };

  const FLOWS = {
    home: ["path", "property", "bill", "roof", "priorities", "timing", "result", "details", "done"],
    business: ["path", "btype", "bbill", "roofsize", "timing", "details", "done"],
    land: ["path", "role", "size", "region", "grid", "stage", "details", "done"]
  };
  const IMGS = { home: "assets/img/roof-hills.webp", business: "assets/img/install-roof.webp", land: "assets/img/farm-aerial.webp" };

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  const fresh = () => ({ path: null, a: {}, i: 0, c: {}, slot: "", ampm: "Morning", dir: 1 });
  let S = fresh();
  const flow = () => FLOWS[S.path || "home"];
  const key = () => flow()[S.i];
  const step = () => STEPS[key()];

  const els = {
    steps: $("[data-q-steps]", root), next: $("[data-q-next]", root), back: $("[data-q-back]", root),
    bar: $("[data-q-bar]", root), prog: $("[data-q-progress]", root), count: $("[data-q-count]", root),
    saved: $("[data-q-saved]", root), summary: $("[data-q-summary]", root), img: $("[data-q-img]", root),
    resume: $("[data-q-resume]", root), hint: $("[data-q-hint]", root)
  };

  let savedTimer;
  const save = (flash = true) => {
    try { localStorage.setItem(KEY, JSON.stringify({ S, t: Date.now() })); } catch (e) { return; }
    if (flash && S.i > 0) {
      els.saved.classList.add("is-on");
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => els.saved.classList.remove("is-on"), 1400);
    }
  };
  const clearSaved = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  const track = (name, extra) => {
    const data = Object.assign({ event: name, step: key(), path: S.path || "unknown", index: S.i }, extra);
    (window.dataLayer = window.dataLayer || []).push(data);
    document.dispatchEvent(new CustomEvent("wh:quote", { detail: data }));
  };

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  const optLabel = (o) => o.label || o.v;
  const answerText = (k) => {
    const st = STEPS[k], v = S.a[k];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "";
    if (st.type === "range") return st.show(v, st.max);
    if (st.type === "multi") return v.map((x) => optLabel(st.options.find((o) => o.v === x) || { v: x })).join(", ");
    if (st.options && st.type === "single") return optLabel(st.options.find((o) => o.v === v) || { v });
    return v;
  };
  const wantsBattery = () => { const p = S.a.priorities || []; return p.includes("backup") || p.includes("night"); };
  const estimate = () => WH.estimate({ bill: (S.a.bill || 250) + ((S.a.priorities || []).includes("ev") ? 60 : 0), battery: wantsBattery() });

  const isValid = () => {
    const st = step(), v = S.a[key()];
    if (st.type === "single" || st.type === "chips") return !!v;
    if (st.type === "multi") return Array.isArray(v) && v.length > 0;
    return true;
  };

  const slots = () => {
    const out = [];
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    while (out.length < 8) {
      d.setDate(d.getDate() + 1);
      const wd = d.getDay();
      if (wd === 0 || wd === 6) continue;
      out.push({
        iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        wd: d.toLocaleDateString("en-NZ", { weekday: "short" }),
        day: d.getDate(),
        mon: d.toLocaleDateString("en-NZ", { month: "short" }),
        long: d.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })
      });
    }
    return out;
  };
  const slotText = () => {
    const s = slots().find((x) => x.iso === S.slot);
    return s ? `${s.long}, ${S.ampm.toLowerCase()}` : "a time that suits you";
  };

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */
  const head = (st) => `
    <span class="label label--accent q-step__k">${esc(st.kicker || "")}</span>
    <h2>${st.title}</h2>
    ${st.sub ? `<p class="q-step__sub">${esc(st.sub)}</p>` : ""}`;

  const renderers = {
    single(st, k) {
      const v = S.a[k];
      const cls = st.big ? "opts opts--3" : "opts";
      return head(st) + `<div class="${cls}" role="radiogroup" aria-label="${esc(st.label)}">` +
        st.options.map((o, n) => `
          <button type="button" class="opt${st.big ? " opt--big" : ""}" role="radio" aria-checked="${v === o.v}" data-v="${esc(o.v)}">
            <span class="opt__ic">${icon(o.icon || "check")}</span>
            <b>${esc(optLabel(o))}</b>${o.desc ? `<span>${esc(o.desc)}</span>` : "<span></span>"}
            <span class="opt__key" aria-hidden="true">${n + 1}</span>
          </button>`).join("") + "</div>";
    },
    multi(st, k) {
      const v = S.a[k] || [];
      return head(st) + `<div class="opts" role="group" aria-label="${esc(st.label)}">` +
        st.options.map((o, n) => `
          <button type="button" class="opt" aria-pressed="${v.includes(o.v)}" data-v="${esc(o.v)}">
            <span class="opt__ic">${icon(o.icon)}</span><b>${esc(optLabel(o))}</b><span>${esc(o.desc || "")}</span>
            <span class="opt__key" aria-hidden="true">${n + 1}</span>
          </button>`).join("") + "</div>";
    },
    chips(st, k) {
      const v = S.a[k];
      return head(st) + `<div class="regions" role="radiogroup" aria-label="${esc(st.label)}">` +
        st.options.map((o) => `<button type="button" role="radio" aria-checked="${v === o}" data-v="${esc(o)}">${esc(o)}</button>`).join("") + "</div>";
    },
    range(st, k) {
      if (S.a[k] == null) S.a[k] = st.def;
      return head(st) + `
        <div class="billbox">
          <div class="field-head"><span>${esc(st.fieldLabel)}</span><output data-range-out></output></div>
          <input class="range" type="range" min="${st.min}" max="${st.max}" step="${st.step}" value="${S.a[k]}" aria-label="${esc(st.fieldLabel)}" data-range>
          <div class="range-scale"><span>$${fmt(st.min)}</span><span>$${fmt((st.min + st.max) / 2)}</span><span>$${fmt(st.max)}+</span></div>
          <div class="q-live" data-range-live></div>
        </div>`;
    },
    result() {
      const e = estimate(), p = e.pkg, a = S.a;
      const roofNote = { "Tile": "Tile roofs need a tile-specific mounting system. We'll include it in your fixed quote.", "Decramastic": "Decramastic roofs need specialist mounting. We'll include it in your fixed quote.", "Membrane or flat": "Flat roofs use tilt frames to angle panels to the sun. We'll design this at your assessment.", "Not sure": "No problem. We'll check your roof type from aerial imagery before we visit." }[a.roof];
      const pref = a.pref && WH.packages[a.pref] && a.pref !== e.id ? WH.packages[a.pref].name : "";
      return `
        <span class="label label--accent q-step__k">Your indicative plan</span>
        <h2>We'd start you with <em>${esc(p.name)}.</em></h2>
        <p class="q-step__sub">Based on a ${esc(answerText("bill"))} bill${wantsBattery() ? " and your interest in backup and evening power" : ""}. Your engineer will fine-tune it at a free site assessment.</p>
        <div class="result">
          <div class="result__hero">
            <img src="${p.img}" alt="">
            <div>
              <span class="label label--dot">Recommended for you</span>
              <h3 class="h-md">${esc(p.name)}</h3>
              <p class="muted small">${p.panels} × 510W JA Solar · ${p.kwp} kWp<br>${esc(p.inverter)}${p.battery ? `<br>${p.battery} kWh SigenStor battery` : ""}</p>
              <div class="row">
                <span class="pill">${icon("shield")}CEC-certified</span>
                <span class="pill">${icon("clock")}10-yr workmanship</span>
              </div>
            </div>
          </div>
          <div class="result__grid">
            <div class="tile tile--gold"><span class="label">Est. yearly saving</span><p class="num">$${fmt(Math.round(e.savings / 10) * 10)}</p></div>
            <div class="tile"><span class="label">Generation / year</span><p class="num">${fmt(e.production)}<em>kWh</em></p></div>
            <div class="tile"><span class="label">Bill covered</span><p class="num">${Math.round(e.coverage * 100)}<em>%</em></p></div>
          </div>
          ${roofNote ? `<div class="note">${icon("question")}<span>${esc(roofNote)}</span></div>` : ""}
          ${pref ? `<div class="note">${icon("check")}<span>You looked at ${esc(pref)} too. We'll price both so you can compare.</span></div>` : ""}
          <div class="note">${icon("dollar")}<span>Spread the cost: interest-free and 1% green loans from Westpac, ANZ, ASB, BNZ, Kiwibank and Q Card. <a class="link" href="solar.html#finance">Finance options</a></span></div>
          <p class="fine">Indicative estimate using $0.33/kWh import, $0.12/kWh export and 1,360 kWh per kWp per year (our Auckland Residence result). Your fixed quote follows the site assessment.</p>
        </div>`;
    },
    details() {
      const c = S.c, land = S.path === "land", biz = S.path === "business";
      const sl = slots();
      return `
        <span class="label label--accent q-step__k">${land ? "Book a discovery call" : "Book your free site assessment"}</span>
        <h2>${land ? "Who should we <em>call?</em>" : "Where should we <em>send your plan?</em>"}</h2>
        <p class="q-step__sub">${land ? "A 30-minute discovery session with our team. We'll confirm the time within one business day." : "We'll confirm your assessment within one business day, then send a fixed quote and savings model."}</p>
        <form class="q-form" novalidate data-q-form>
          <div class="form__row">
            <div class="input"><input id="q-first" name="first" placeholder=" " autocomplete="given-name" required value="${esc(c.first)}"><label for="q-first">First name</label></div>
            <div class="input"><input id="q-last" name="last" placeholder=" " autocomplete="family-name" value="${esc(c.last)}"><label for="q-last">Last name</label></div>
          </div>
          <div class="form__row">
            <div class="input"><input id="q-phone" name="phone" type="tel" placeholder=" " autocomplete="tel" required value="${esc(c.phone)}"><label for="q-phone">Phone</label></div>
            <div class="input"><input id="q-email" name="email" type="email" placeholder=" " autocomplete="email" required value="${esc(c.email)}"><label for="q-email">Email</label></div>
          </div>
          ${biz || land ? `<div class="input"><input id="q-company" name="company" placeholder=" " autocomplete="organization" value="${esc(c.company)}"><label for="q-company">Company (optional)</label></div>` : ""}
          <div class="input"><input id="q-address" name="address" placeholder=" " autocomplete="street-address" value="${esc(c.address)}"><label for="q-address">${land ? "Site location (optional)" : "Property address"}</label></div>
          <div>
            <div class="field-head" style="margin:10px 0 12px"><span>${land ? "Preferred day for a call" : "Preferred assessment day"}</span><span class="muted small" style="text-transform:none;letter-spacing:0;font-family:var(--sans)">Optional</span></div>
            <div class="slots" role="radiogroup" aria-label="Preferred day">
              ${sl.map((s) => `<button type="button" class="slot" role="radio" aria-checked="${S.slot === s.iso}" data-slot="${s.iso}"><span>${s.wd}</span><b>${s.day}</b><span>${s.mon}</span></button>`).join("")}
            </div>
            <div class="ampm" role="radiogroup" aria-label="Preferred time">
              ${["Morning", "Afternoon"].map((t) => `<button type="button" role="radio" aria-checked="${S.ampm === t}" data-ampm="${t}">${t}</button>`).join("")}
            </div>
          </div>
          <div class="input"><textarea id="q-notes" name="notes" placeholder=" " maxlength="300">${esc(c.notes)}</textarea><label for="q-notes">Anything we should know? (optional)</label></div>
          <p class="fine">We'll only use your details to prepare your plan and contact you about it. Prefer to talk? Call <a href="tel:+642109058051" class="link">+64 21 090 58051</a></p>
          <button type="submit" hidden></button>
        </form>`;
    },
    done() {
      const land = S.path === "land";
      return `
        <div class="done">
          <div class="done__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
          <span class="label label--accent q-step__k">You're all set${S.c.first ? `, ${esc(S.c.first)}` : ""}</span>
          <h2>${land ? "Thanks. Your enquiry is with <em>our team.</em>" : "Thanks. Your solar plan is with <em>our team.</em>"}</h2>
          <p class="q-step__sub">We'll call you within one business day to confirm ${esc(slotText())}.</p>
          ${S.via === "email" ? `<p class="note" style="margin-bottom:8px">${icon("mail")}<span>Your email app has opened with your details. Just press send to reach us.</span></p>` : ""}
          <ol class="next-steps">
            ${land ? `
              <li><span>01</span><div><b>Discovery call</b><p>We'll talk through your goals, the site and timelines.</p></div></li>
              <li><span>02</span><div><b>Initial screening</b><p>Grid proximity, zoning, overlays and constraints, at a high level.</p></div></li>
              <li><span>03</span><div><b>Terms of engagement</b><p>A clear scope with timelines, deliverables and responsibilities.</p></div></li>` : `
              <li><span>01</span><div><b>Confirmation call</b><p>A quick chat to confirm your time and answer any questions.</p></div></li>
              <li><span>02</span><div><b>Free site assessment</b><p>We check your roof, switchboard and usage. About 45 minutes.</p></div></li>
              <li><span>03</span><div><b>Fixed quote &amp; savings model</b><p>Your exact system, price and expected ROI, with no pressure to sign.</p></div></li>`}
          </ol>
          <div class="row">
            ${S.slot ? `<button type="button" class="btn btn--gold" data-ics>Add to calendar <span class="btn__icon">${icon("calendar")}</span></button>` : ""}
            <a class="btn btn--ghost" href="index.html">Back to home <span class="btn__icon">${icon("arrow")}</span></a>
          </div>
          <p class="label mt-m">Reference ${esc(S.ref || "")}</p>
        </div>`;
    }
  };

  function render(focus = true) {
    const k = key(), st = step();
    const total = flow().length - 1;
    const idx = Math.min(S.i, total);
    const pct = st.type === "done" ? 100 : Math.round(idx / total * 100);
    els.bar.style.width = pct + "%";
    els.prog.setAttribute("aria-valuenow", pct);
    els.count.textContent = st.type === "done" ? "Complete" : `Step ${S.i + 1} of ${total}`;

    const div = document.createElement("div");
    div.className = "q-step is-active" + (S.dir < 0 ? " is-back" : "");
    div.innerHTML = renderers[st.type](st, k);
    els.steps.replaceChildren(div);
    bind(div, st, k);

    els.back.disabled = S.i === 0 || st.type === "done";
    els.next.hidden = st.type === "done";
    els.hint.hidden = st.type === "done" || st.type === "details";
    els.next.firstChild.textContent = (st.next || "Continue") + " ";
    els.next.disabled = !isValid();
    if (els.img && S.path && els.img.getAttribute("src") !== IMGS[S.path]) els.img.src = IMGS[S.path];
    renderSummary();
    if (focus) {
      const target = $("h2", div);
      if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      const top = root.getBoundingClientRect().top + scrollY;
      if (scrollY > top + 10 || innerWidth <= 980) window.scrollTo({ top: innerWidth <= 980 ? $(".q__main", root).offsetTop - 10 : top, behavior: reduce ? "auto" : "smooth" });
    }
  }

  function renderSummary() {
    const rows = flow().slice(0, -1)
      .filter((k) => STEPS[k].label && answerText(k) && !["result", "details"].includes(k))
      .map((k) => `<div><dt>${esc(STEPS[k].label)}</dt><dd>${esc(answerText(k))}</dd></div>`);
    if (S.path === "home" && S.a.bill && (S.a.priorities || []).length) {
      rows.push(`<div><dt>Suggested</dt><dd style="color:var(--gold-2)">${esc(estimate().pkg.name)}</dd></div>`);
    }
    els.summary.innerHTML = rows.length ? rows.join("") : '<div class="empty">Your answers will appear here</div>';
  }

  function bind(div, st, k) {
    if (st.type === "single" || st.type === "chips") {
      $$("[data-v]", div).forEach((b) => b.addEventListener("click", () => choose(b.dataset.v)));
    }
    if (st.type === "multi") {
      $$("[data-v]", div).forEach((b) => b.addEventListener("click", () => toggle(b.dataset.v)));
    }
    if (st.type === "range") {
      const r = $("[data-range]", div), out = $("[data-range-out]", div), live = $("[data-range-live]", div);
      const upd = () => {
        const v = +r.value;
        S.a[k] = v;
        r.style.setProperty("--p", ((v - st.min) / (st.max - st.min) * 100) + "%");
        out.textContent = st.show(v, st.max).replace("/mo", "");
        if (k === "bill") {
          const e = WH.estimate({ bill: v, battery: false });
          live.innerHTML = `<span class="pill">≈ <b>${fmt(e.usage)}</b> kWh / year</span><span class="pill">Likely system <b>${e.pkg.kwp} kWp</b></span><span class="pill">Up to <b>$${fmt(Math.round(e.savings / 10) * 10)}</b> / yr back</span>`;
        } else {
          const kwh = Math.max(0, v * 12 / 0.26);
          live.innerHTML = `<span class="pill">≈ <b>${fmt(kwh)}</b> kWh / year</span><span class="pill">Indicative <b>${fmt(Math.max(20, Math.round(kwh / 1360 * 0.7 / 5) * 5))} kWp</b> system</span>`;
        }
        renderSummary();
      };
      r.addEventListener("input", upd);
      r.addEventListener("change", () => save());
      upd();
    }
    if (st.type === "details") {
      const form = $("[data-q-form]", div);
      form.addEventListener("input", (e) => { if (e.target.name) { S.c[e.target.name] = e.target.value; e.target.closest(".input")?.classList.remove("is-invalid"); save(false); } });
      form.addEventListener("submit", (e) => { e.preventDefault(); next(); });
      $$("[data-slot]", div).forEach((b) => b.addEventListener("click", () => {
        S.slot = S.slot === b.dataset.slot ? "" : b.dataset.slot;
        $$("[data-slot]", div).forEach((x) => x.setAttribute("aria-checked", String(x.dataset.slot === S.slot)));
        save();
      }));
      $$("[data-ampm]", div).forEach((b) => b.addEventListener("click", () => {
        S.ampm = b.dataset.ampm;
        $$("[data-ampm]", div).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        save();
      }));
    }
    if (st.type === "done") {
      const ics = $("[data-ics]", div);
      ics && ics.addEventListener("click", downloadIcs);
    }
  }

  let autoTimer;
  function choose(v) {
    const k = key(), st = step();
    S.a[k] = v;
    els.resume.classList.remove("is-on");
    if (k === "path") {
      if (S.path !== v) { const keep = S.a.path; S.a = { path: keep }; }
      S.path = v;
    }
    $$("[data-v]", els.steps).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
    els.next.disabled = false;
    renderSummary();
    save();
    track("wh_quote_answer", { answer: v });
    clearTimeout(autoTimer);
    autoTimer = setTimeout(next, st.type === "chips" ? 260 : 380);
  }

  function toggle(v) {
    const k = key();
    const arr = new Set(S.a[k] || []);
    arr.has(v) ? arr.delete(v) : arr.add(v);
    S.a[k] = [...arr];
    $$("[data-v]", els.steps).forEach((b) => b.setAttribute("aria-pressed", String(arr.has(b.dataset.v))));
    els.next.disabled = !isValid();
    renderSummary();
    save();
  }

  function validateDetails() {
    const form = $("[data-q-form]", els.steps);
    let first = null;
    $$("[required]", form).forEach((f) => {
      const bad = !f.value.trim() || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value.trim())) || (f.type === "tel" && f.value.replace(/\D/g, "").length < 7);
      f.closest(".input").classList.toggle("is-invalid", bad);
      if (bad && !first) first = f;
    });
    if (first) { first.focus(); return false; }
    return true;
  }

  async function submit() {
    const e = S.path === "home" ? estimate() : null;
    S.ref = "WH-" + Date.now().toString(36).toUpperCase().slice(-6);
    const answers = {};
    flow().forEach((k) => { const t = answerText(k); if (t && STEPS[k].label && k !== "path") answers[STEPS[k].label] = t; });
    const payload = Object.assign({
      reference: S.ref,
      enquiry: { home: "Home solar", business: "Business solar", land: "Land / utility-scale" }[S.path],
      name: [S.c.first, S.c.last].filter(Boolean).join(" "),
      phone: S.c.phone, email: S.c.email, company: S.c.company || "", address: S.c.address || "",
      preferredDay: S.slot || "Flexible", preferredTime: S.slot ? S.ampm : "",
      notes: S.c.notes || ""
    }, answers, e ? {
      recommendedPackage: e.pkg.name,
      estYearlySaving: "$" + fmt(Math.round(e.savings / 10) * 10),
      estGenerationKwh: fmt(e.production),
      interestedIn: S.a.pref ? WH.packages[S.a.pref]?.name : ""
    } : {});
    els.next.disabled = true;
    const res = await WH.submit(payload, `Solar planner: ${payload.enquiry} — ${payload.name} (${S.ref})`);
    S.via = res.via;
    track("wh_quote_submit", { via: res.via });
  }

  async function next() {
    clearTimeout(autoTimer);
    const st = step();
    if (st.type === "done") return;
    if (st.type === "details") {
      if (!validateDetails()) return;
      await submit();
      clearSaved();
    } else if (!isValid()) return;
    if (S.i < flow().length - 1) {
      S.i++; S.dir = 1;
      if (step().type !== "done") save(false);
      track("wh_quote_step");
      render();
    }
  }

  function back() {
    clearTimeout(autoTimer);
    if (S.i === 0) return;
    S.i--; S.dir = -1;
    save(false);
    render();
  }

  function downloadIcs() {
    const s = slots().find((x) => x.iso === S.slot);
    if (!s) return;
    const d = s.iso.replace(/-/g, "");
    const [h1, h2] = S.ampm === "Morning" ? ["090000", "120000"] : ["130000", "160000"];
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const what = S.path === "land" ? "Watthaus discovery call (to be confirmed)" : "Watthaus solar site assessment (to be confirmed)";
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Watthaus Strategy//Solar Planner//EN", "BEGIN:VEVENT",
      `UID:${S.ref}@watthausstrategy.co.nz`, `DTSTAMP:${now}`, `DTSTART:${d}T${h1}`, `DTEND:${d}T${h2}`,
      `SUMMARY:${what}`, `DESCRIPTION:Reference ${S.ref}. Watthaus will call to confirm the exact time. +64 21 090 58051`,
      S.c.address ? `LOCATION:${S.c.address.replace(/[,;]/g, "\\$&")}` : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "watthaus-booking.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ------------------------------------------------------------------
     Keyboard
     ------------------------------------------------------------------ */
  document.addEventListener("keydown", (e) => {
    if (!document.body.contains(root)) return; // planner was swapped out
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = ["input", "textarea", "select"].includes(tag) && e.target.type !== "range";
    const st = step();
    if (!typing && /^[1-9]$/.test(e.key) && (st.type === "single" || st.type === "multi")) {
      const o = st.options[+e.key - 1];
      if (o) { e.preventDefault(); st.type === "single" ? choose(o.v) : toggle(o.v); }
    }
    if (e.key === "Enter" && !typing && tag !== "button" && tag !== "a") { e.preventDefault(); next(); }
  });
  els.next.addEventListener("click", next);
  els.back.addEventListener("click", back);

  /* ------------------------------------------------------------------
     Boot: URL params → resume → fresh
     ------------------------------------------------------------------ */
  const qp = new URLSearchParams(location.search);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  const recent = saved && saved.S && saved.S.i > 0 && Date.now() - saved.t < 1000 * 60 * 60 * 24 * 30;

  if (qp.get("path") && FLOWS[qp.get("path")]) {
    S.path = qp.get("path"); S.a.path = S.path; S.i = 1;
  } else if (qp.get("package") || qp.get("bill")) {
    S.path = "home"; S.a.path = "home"; S.i = 1;
    const bill = parseInt(qp.get("bill"), 10);
    if (bill >= 100 && bill <= 800) S.a.bill = bill;
    if (WH.packages[qp.get("package")]) S.a.pref = qp.get("package");
    if (qp.get("battery") === "1" || (WH.packages[qp.get("package")] || {}).battery) S.a.priorities = ["bills", "backup", "night"];
  } else if (recent) {
    els.resume.classList.add("is-on");
    $("[data-q-resume-yes]", root).addEventListener("click", () => { S = Object.assign(fresh(), saved.S); S.dir = 1; els.resume.classList.remove("is-on"); render(); track("wh_quote_resume"); });
    $("[data-q-resume-no]", root).addEventListener("click", () => { clearSaved(); els.resume.classList.remove("is-on"); });
  }
  render(false);
  track("wh_quote_start");
  };
  if (document.querySelector("[data-quote]")) window.WH.initQuote();
})();
