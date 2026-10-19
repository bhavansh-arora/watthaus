/* Watthaus Strategy — site interactions. Vanilla JS, no dependencies. */
(() => {
  "use strict";
  const d = document;
  const html = d.documentElement;
  const C = window.WH_CONFIG || {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine) and (hover: hover)").matches;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const WH = (window.WH = window.WH || {});
  const fmt = (n, dec = 0) => Number(n).toLocaleString("en-NZ", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  WH.fmt = fmt;

  /* ------------------------------------------------------------------
     Packages + savings estimate (calculator and planner share this)
     ------------------------------------------------------------------ */
  WH.packages = {
    "bright-start": { name: "Bright Start", type: "grid", panels: 16, kwp: 8.16, inverter: "5kW Sigenergy Controller & Gateway", battery: 0, img: "assets/img/roof-aerial.webp" },
    "bright-boost": { name: "Bright Boost", type: "grid", panels: 30, kwp: 15.3, inverter: "10kW Sigenergy Controller & Gateway", battery: 0, img: "assets/img/roof-boost.webp" },
    "sunny-reserve": { name: "Sunny Reserve", type: "hybrid", panels: 16, kwp: 8.16, inverter: "5kW Sigenergy Controller & Gateway", battery: 6, img: "assets/img/battery-install.webp" },
    "sunny-reserve-plus": { name: "Sunny Reserve Plus", type: "hybrid", panels: 30, kwp: 15.3, inverter: "10kW Sigenergy Controller & Gateway", battery: 10, img: "assets/img/roof-topdown.webp" }
  };

  WH.estimate = ({ bill = 250, battery = false } = {}) => {
    const price = C.pricePerKwh || 0.33;
    const usage = Math.max(0, (bill - (C.dailyCharge || 2) * 30.4) * 12 / price);
    const large = usage > 9000;
    const id = battery ? (large ? "sunny-reserve-plus" : "sunny-reserve") : (large ? "bright-boost" : "bright-start");
    const p = WH.packages[id];
    const production = p.kwp * (C.yieldPerKwp || 1360);
    const selfFrac = p.battery ? (p.battery >= 10 ? 0.75 : 0.68) : 0.4;
    const selfUsed = Math.min(production * selfFrac, usage * 0.9);
    const exported = production - selfUsed;
    // never promise more than the energy part of the bill
    const savings = Math.min(selfUsed * price + exported * (C.exportRate || 0.12), usage * price * 0.95);
    return { id, pkg: p, usage, production, savings, coverage: clamp(savings / (bill * 12), 0, 1), co2: production * (C.co2PerKwh || 0.102) / 1000 };
  };

  /* ------------------------------------------------------------------
     Lead submission (planner + contact form)
     ------------------------------------------------------------------ */
  WH.submit = async (payload, subject) => {
    const data = Object.assign({ submittedAt: new Date().toISOString(), page: location.pathname, referrer: d.referrer || "", utm: Object.fromEntries(new URLSearchParams(location.search)) }, payload);
    if (C.formEndpoint) {
      try {
        const r = await fetch(C.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
        if (r.ok) return { ok: true, via: "endpoint" };
      } catch (e) { /* fall back to email */ }
    }
    const lines = Object.entries(payload).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    window.location.href = `mailto:${C.leadEmail}?subject=${encodeURIComponent(subject || "Website enquiry")}&body=${encodeURIComponent(lines.join("\n"))}`;
    return { ok: true, via: "email" };
  };

  /* ------------------------------------------------------------------
     Split headings into masked words (descender-safe, see .w in CSS)
     ------------------------------------------------------------------ */
  function splitWords(el) {
    let i = 0;
    const word = (content) => {
      const w = d.createElement("span");
      w.className = "w";
      const s = d.createElement("span");
      s.style.setProperty("--i", Math.min(i++, 16));
      typeof content === "string" ? (s.textContent = content) : s.appendChild(content);
      w.appendChild(s);
      return w;
    };
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            frag.appendChild(/^\s+$/.test(p) ? d.createTextNode(" ") : word(p));
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          if (n.classList.contains("foil") || n.classList.contains("rotator") || n.classList.contains("ipill")) {
            const ph = d.createComment("");
            n.replaceWith(ph);
            ph.replaceWith(word(n));
          } else walk(n);
        }
      });
    };
    walk(el);
  }
  $$("[data-lines]").forEach(splitWords);

  /* scroll-scrubbed statements: words (and inline image pills) light up as you read */
  const scrubs = $$("[data-scrub]").map((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(" ")); return; }
            const s = d.createElement("span");
            s.className = "scrub";
            s.textContent = p;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          if (n.classList.contains("ipill")) n.classList.add("scrub");
          else walk(n);
        }
      });
    };
    walk(el);
    return { el, parts: $$(".scrub", el) };
  });

  /* ------------------------------------------------------------------
     Preloader, page entry, page transitions
     ------------------------------------------------------------------ */
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    initReveals();
    initHero();
  };
  const finishLoading = () => { html.classList.remove("is-loading"); try { sessionStorage.setItem("wh-seen", "1"); } catch (e) {} };

  if (html.classList.contains("is-loading")) {
    const count = $("[data-count-loader]");
    const bar = $(".preloader__bar");
    let fontsReady = false, imgReady = false;
    (d.fonts ? d.fonts.ready : Promise.resolve()).then(() => (fontsReady = true));
    const firstImg = $(".hero img, .page-hero img");
    if (!firstImg || firstImg.complete) imgReady = true;
    else { firstImg.addEventListener("load", () => (imgReady = true)); firstImg.addEventListener("error", () => (imgReady = true)); }
    const t0 = performance.now();
    let shown = 0;
    const MIN = 1500, MAX = 3500;
    const tick = (now) => {
      const el = now - t0;
      const ready = (fontsReady && imgReady) || el > MAX;
      const target = ready ? 100 : Math.min(90, el / MIN * 90);
      shown += (Math.min(target, Math.min(100, el / MIN * 100)) - shown) * 0.12;
      if (ready && el >= MIN && shown > 99.4) shown = 100;
      const n = Math.round(shown);
      if (count) count.textContent = String(n).padStart(3, "0");
      if (bar) bar.style.setProperty("--p", (shown / 100).toFixed(3));
      if (n < 100) return requestAnimationFrame(tick);
      setTimeout(() => {
        html.classList.add("is-loaded");
        finishLoading();
        setTimeout(start, 250);
        setTimeout(() => html.classList.remove("is-loaded"), 1200);
      }, 160);
    };
    requestAnimationFrame(tick);
  } else if (html.classList.contains("is-entering")) {
    // hold the destination title briefly, then lift the curtain
    setTimeout(() => {
      html.classList.add("is-entered");
      setTimeout(start, 200);
      setTimeout(() => html.classList.remove("is-entering", "is-entered"), 1300);
    }, 320);
  } else start();

  const PAGES = {
    "index.html": "Home|Energy engineered forward",
    "solar.html": "Home Solar|Rooftop solar & batteries",
    "consultancy.html": "Consultancy|Land to energisation",
    "projects.html": "Our Projects|Auckland Residence case study",
    "about.html": "About Us|The people behind the power",
    "contact.html": "Let's Talk|Reply within one business day",
    "quote.html": "Solar Planner|Your plan in about a minute"
  };
  if (!reduce) {
    d.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.getAttribute("href"), location.href);
      if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname) || url.pathname === location.pathname) return;
      e.preventDefault();
      const page = url.pathname.split("/").pop() || "index.html";
      const label = PAGES[page] || "Watthaus|Energy engineered forward";
      if (window.whCurtain) window.whCurtain(label);
      try { sessionStorage.setItem("wh-nav", label); } catch (err) {}
      html.classList.add("is-leaving");
      setTimeout(() => (location.href = url.href), 820);
    });
    addEventListener("pageshow", (e) => { if (e.persisted) html.classList.remove("is-leaving", "is-entering", "is-entered"); });
  }

  /* ------------------------------------------------------------------
     Reveals + counters
     ------------------------------------------------------------------ */
  function initReveals() {
    const els = $$("[data-reveal], [data-lines], [data-count], [data-donut]");
    if (!("IntersectionObserver" in window) || reduce) {
      els.forEach((el) => { el.classList.add("is-in"); if (el.dataset.count) countUp(el, true); if (el.dataset.donut) donut(el); });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        if (e.target.dataset.count) countUp(e.target);
        if (e.target.dataset.donut) donut(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((el) => io.observe(el));
  }
  function donut(el) {
    const c = $(".fg", el);
    if (!c) return;
    const len = 2 * Math.PI * parseFloat(c.getAttribute("r"));
    c.style.strokeDasharray = `${len * parseFloat(el.dataset.donut) / 100} ${len}`;
  }
  function countUp(el, instant) {
    const to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || "0", 10);
    if (instant || reduce) { el.textContent = fmt(to, dec); return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = clamp((t - t0) / 1900, 0, 1);
      el.textContent = fmt(to * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)), dec);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------
     Hero slideshow, rotating word and light glow
     ------------------------------------------------------------------ */
  function initHero() {
    const hero = $("[data-hero]");
    if (!hero) return;
    const slides = $$(".hero__slide", hero);
    const rot = $(".rotator", hero);
    const words = rot ? $$(".rotator__word", rot) : [];
    const countEl = $("[data-hero-count]", hero);
    const counter = $(".hero__count", hero);
    let i = 0;
    const fit = () => { if (rot && words[i]) rot.style.width = words[i].getBoundingClientRect().width + "px"; };
    const show = (n) => {
      slides.forEach((s, k) => s.classList.toggle("is-active", k === n));
      words.forEach((w, k) => { w.classList.toggle("is-current", k === n); w.classList.toggle("is-out", k === (n - 1 + words.length) % words.length && k !== n); });
      i = n;
      fit();
      if (countEl) countEl.textContent = String(n + 1).padStart(2, "0");
      if (counter) { counter.classList.remove("is-ticking"); void counter.offsetWidth; counter.classList.add("is-ticking"); }
    };
    if (rot) { rot.classList.add("is-live"); show(0); addEventListener("resize", fit); d.fonts && d.fonts.ready.then(fit); }
    if (slides.length > 1 && !reduce) setInterval(() => { if (!d.hidden) show((i + 1) % slides.length); }, 7000);
  }

  const cv = $("[data-hero-glow]");
  if (cv && !reduce) {
    const ctx = cv.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, motes = [], running = true, t = 0, tx = .78, ty = .14, sx = tx, sy = ty, pointer = false;
    const size = () => {
      const r = cv.getBoundingClientRect(); w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: w < 700 ? 22 : 50 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + .4, v: Math.random() * .3 + .08, p: Math.random() * 6.3, a: Math.random() * .45 + .15 }));
    };
    size(); addEventListener("resize", size);
    cv.parentElement.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; pointer = true; });
    cv.parentElement.addEventListener("pointerleave", () => (pointer = false));
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) requestAnimationFrame(draw); }).observe(cv);
    function draw() {
      if (!running || d.hidden) return;
      t += .006;
      if (!pointer) { tx = .78 + Math.sin(t) * .05; ty = .14 + Math.cos(t * .8) * .04; }
      sx = lerp(sx, tx, .05); sy = lerp(sy, ty, .05);
      const gx = sx * w, gy = sy * h, R = Math.max(w, h) * .5;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R);
      g.addColorStop(0, "rgba(255,226,165,.34)"); g.addColorStop(.14, "rgba(242,200,120,.14)"); g.addColorStop(.45, "rgba(217,130,50,.04)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      motes.forEach((m) => {
        m.y -= m.v; m.x += Math.sin(t * 3 + m.p) * .22;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        const a = m.a * (.3 + Math.max(0, 1 - Math.hypot(m.x - gx, m.y - gy) / R)) * (.6 + .4 * Math.sin(t * 4 + m.p));
        ctx.fillStyle = `rgba(255,232,190,${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    d.addEventListener("visibilitychange", () => { if (!d.hidden && running) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  /* ------------------------------------------------------------------
     Header, menu, sticky CTA, scroll effects
     ------------------------------------------------------------------ */
  const header = $("[data-header]");
  const toggle = $("[data-menu-toggle]");
  const sticky = $("[data-sticky-cta]");
  const bar = $(".scroll-progress");
  const setMenu = (open) => {
    d.body.classList.toggle("menu-open", open);
    if (toggle) { toggle.setAttribute("aria-expanded", String(open)); toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu"); }
  };
  toggle && toggle.addEventListener("click", () => setMenu(!d.body.classList.contains("menu-open")));
  $$("#mobile-menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  $$("[data-top]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }));

  const parallax = reduce ? [] : $$("[data-parallax]");
  const hs = $("[data-hscroll]");
  const hsTrack = hs && $(".hs__track", hs);
  const hsImgs = hs ? $$(".hcard__img img", hs) : [];
  let hsDist = 0;
  const hsOn = () => hs && innerWidth > 980 && !reduce;
  const sizeHs = () => {
    if (!hs) return;
    if (!hsOn()) { hs.style.height = ""; hsTrack.style.transform = ""; return; }
    hsDist = Math.max(0, hsTrack.scrollWidth - innerWidth);
    hs.style.height = `${hsDist + innerHeight}px`;
  };
  sizeHs(); addEventListener("resize", sizeHs); addEventListener("load", sizeHs);
  const scards = reduce ? [] : $$(".scard");
  const quote = d.body.classList.contains("q-body");

  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    const y = scrollY, vh = innerHeight;
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      if (!d.body.classList.contains("menu-open") && !quote) {
        if (y > lastY + 6 && y > 600) header.classList.add("is-hidden");
        else if (y < lastY - 6 || y < 300) header.classList.remove("is-hidden");
      }
    }
    if (sticky) sticky.classList.toggle("is-on", y > vh * .7);
    if (bar) { const max = d.documentElement.scrollHeight - vh; bar.style.setProperty("--sp", max > 0 ? (y / max).toFixed(4) : 0); }
    lastY = y;

    parallax.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -(parseFloat(el.dataset.parallax) || .1)).toFixed(1)}px, 0)`;
    });

    scrubs.forEach(({ el, parts }) => {
      const r = el.getBoundingClientRect();
      const p = clamp((vh * .82 - r.top) / (r.height + vh * .3), 0, 1);
      const n = Math.round(p * parts.length);
      parts.forEach((w, k) => w.classList.toggle("is-on", k < n));
    });

    if (hsOn()) {
      const r = hs.getBoundingClientRect();
      const p = clamp(-r.top / (hs.offsetHeight - vh), 0, 1);
      hsTrack.style.transform = `translate3d(${(-p * hsDist).toFixed(1)}px, 0, 0)`;
      hs.style.setProperty("--hp", p.toFixed(4));
      hsImgs.forEach((img) => {
        const b = img.parentElement.getBoundingClientRect();
        img.style.transform = `scale(1.14) translate3d(${(((b.left + b.width / 2) - innerWidth / 2) / innerWidth * -7).toFixed(2)}%, 0, 0)`;
      });
    }

    scards.forEach((card, k) => {
      const next = scards[k + 1];
      if (!next) return;
      const top = parseFloat(getComputedStyle(card).top) || 0;
      const p = clamp((top + card.offsetHeight - next.getBoundingClientRect().top) / card.offsetHeight, 0, 1);
      card.style.transform = `scale(${(1 - p * .05).toFixed(4)})`;
      card.style.filter = `brightness(${(1 - p * .45).toFixed(3)})`;
    });
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ------------------------------------------------------------------
     Cursor + magnetic
     ------------------------------------------------------------------ */
  if (fine && !reduce) {
    html.classList.add("has-cursor");
    const cur = $(".cursor"), ring = $(".cursor__ring", cur), dot = $(".cursor__dot", cur), label = $(".cursor__label", cur);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`; }, { passive: true });
    (function loop() { rx = lerp(rx, mx, .2); ry = lerp(ry, my, .2); ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`; requestAnimationFrame(loop); })();
    d.addEventListener("mouseover", (e) => {
      const lab = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button, summary, label, [role='tab'], input[type='range']");
      cur.classList.toggle("is-label", !!lab);
      cur.classList.toggle("is-link", !lab && !!link);
      if (lab) label.textContent = lab.dataset.cursor;
    });
    d.addEventListener("mouseleave", () => (cur.style.opacity = "0"));
    d.addEventListener("mouseenter", () => (cur.style.opacity = "1"));
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .2}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`; });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  }

  /* ------------------------------------------------------------------
     Toggle groups
     ------------------------------------------------------------------ */
  $$("[data-toggle]").forEach((group) => {
    const btns = $$("button", group), pill = $(".toggle__pill", group);
    const scope = group.closest("[data-toggle-scope]") || d;
    const current = () => btns.find((b) => b.getAttribute("aria-pressed") === "true") || btns[0];
    const place = (b) => { if (pill) { pill.style.width = `${b.offsetWidth}px`; pill.style.transform = `translateX(${b.offsetLeft - 4}px)`; } };
    const select = (b) => {
      btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      place(b);
      $$("[data-set]", scope).forEach((s) => s.classList.toggle("is-active", s.dataset.set === b.dataset.target));
    };
    btns.forEach((b) => b.addEventListener("click", () => select(b)));
    requestAnimationFrame(() => place(current()));
    addEventListener("resize", () => place(current()));
    d.fonts && d.fonts.ready.then(() => place(current()));
  });

  /* ------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------ */
  $$("[data-tabs]").forEach((wrap) => {
    const tabs = $$("[role='tab']", wrap);
    const show = (t, focus) => {
      tabs.forEach((x) => {
        const on = x === t;
        x.setAttribute("aria-selected", String(on));
        x.tabIndex = on ? 0 : -1;
        const p = d.getElementById(x.getAttribute("aria-controls"));
        if (p) { p.hidden = !on; p.classList.toggle("is-active", on); }
      });
      if (focus) t.focus();
      if (innerWidth <= 980) t.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
    };
    tabs.forEach((t, k) => {
      t.addEventListener("click", () => show(t));
      t.addEventListener("keydown", (e) => {
        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) return;
        e.preventDefault();
        show(tabs[(k + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length], true);
      });
    });
    const fromHash = tabs.find((t) => t.dataset.key === location.hash.slice(1));
    if (fromHash) show(fromHash);
  });

  /* ------------------------------------------------------------------
     Accordions
     ------------------------------------------------------------------ */
  $$(".acc details").forEach((det) => {
    const sum = $("summary", det), body = $(".acc__body", det);
    if (!sum || !body || reduce) return;
    sum.addEventListener("click", (e) => {
      e.preventDefault();
      if (det.dataset.anim) return;
      det.dataset.anim = "1";
      if (det.open) {
        const a = body.animate([{ height: `${body.scrollHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 450, easing: "cubic-bezier(.65,0,.35,1)" });
        a.onfinish = () => { det.open = false; delete det.dataset.anim; };
      } else {
        det.open = true;
        const a = body.animate([{ height: "0px", opacity: 0 }, { height: `${body.scrollHeight}px`, opacity: 1 }], { duration: 550, easing: "cubic-bezier(.16,1,.3,1)" });
        a.onfinish = () => delete det.dataset.anim;
      }
    });
  });

  /* ------------------------------------------------------------------
     Live sun model — real Auckland time, sample 10.12 kW system
     ------------------------------------------------------------------ */
  const KWP = 10.12, MAXP = KWP * .55;
  const SUN = [[6.2, 20.7], [6.75, 20.25], [7.25, 19.7], [6.9, 18.2], [7.2, 17.4], [7.5, 17.2], [7.5, 17.3], [7.1, 17.75], [6.6, 18.5], [6.7, 19.6], [6.1, 20.1], [5.95, 20.55]];
  const SEASON = [1, .95, .85, .72, .6, .55, .57, .66, .78, .88, .96, 1];
  const sunModel = () => {
    const parts = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", minute: "numeric", month: "numeric", hourCycle: "h23" })
      .formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
    const h = +parts.hour + +parts.minute / 60, m = +parts.month - 1;
    const [rise, set] = SUN[m], peak = MAXP * SEASON[m];
    const P = (x) => (x <= rise || x >= set) ? 0 : peak * Math.pow(Math.sin(Math.PI * (x - rise) / (set - rise)), 1.3);
    let total = 0, sofar = 0;
    for (let x = 4; x <= 22; x += .05) { total += P(x) * .05; if (x <= h) sofar += P(x) * .05; }
    const hh = +parts.hour;
    return { h, rise, set, P, kw: P(h), sofar, total, day: h > rise && h < set, time: `${((hh + 11) % 12) + 1}:${parts.minute}${hh < 12 ? "am" : "pm"}` };
  };
  const curve = (S, x0, x1, X, Y, upto) => {
    const pts = [];
    for (let x = x0; x <= (upto == null ? x1 : Math.min(upto, x1)) + 1e-6; x += .05) pts.push(`${X(x).toFixed(1)},${Y(S.P(x)).toFixed(1)}`);
    return pts;
  };

  const dash = $("[data-sun-dash]");
  if (dash) {
    const svg = $("svg", dash), X = (x) => 20 + (x - 4) / 18 * 560, Y = (k) => 200 - k / MAXP * 170;
    const render = () => {
      const S = sunModel();
      $(".ghost", svg).setAttribute("d", "M" + curve(S, 4, 22, X, Y).join("L"));
      const done = curve(S, 4, 22, X, Y, S.h);
      if (done.length > 1) {
        $(".curve", svg).setAttribute("d", "M" + done.join("L"));
        $(".area", svg).setAttribute("d", `M${X(4)},200L${done.join("L")}L${done[done.length - 1].split(",")[0]},200Z`);
      }
      const sx = X(clamp(S.h, 4, 22)), sy = Y(S.kw);
      ["sun", "halo"].forEach((c) => { const el = $("." + c, svg); el.setAttribute("cx", sx); el.setAttribute("cy", sy); el.style.opacity = S.day ? 1 : 0; });
      const set = (k, v) => $$(`[data-dash='${k}']`).forEach((el) => (el.textContent = v));
      set("time", S.time); set("kw", fmt(S.kw, 1)); set("kwh", fmt(S.sofar, 1)); set("save", "$" + fmt(S.sofar * .3, 2)); set("total", fmt(S.total, 0));
      set("state", S.day ? (S.h < S.rise + 1.5 ? "Sun's just up, panels waking" : S.h > S.set - 1.5 ? "Golden hour, topping up the battery" : "Panels generating, battery charging") : (S.h >= S.set ? "Sun's down, battery running the house" : "Before sunrise, running on stored sun"));
    };
    render(); setInterval(render, 30000);
  }
  const live = $("[data-live-card]");
  if (live) {
    const X = (x) => (x - 5) / 16 * 260, Y = (k) => 42 - k / MAXP * 38;
    const render = () => {
      const S = sunModel();
      $("[data-live='kw']", live).textContent = fmt(S.kw, 1);
      const pre = !S.day && S.h < S.rise;
      $("[data-live='kwh']", live).textContent = fmt(pre ? S.total : S.sofar, 0);
      $("[data-live='kwh-label']", live).textContent = pre ? "Forecast today" : "Today so far";
      $("[data-live='time']", live).textContent = S.time;
      $(".spark-ghost", live).setAttribute("d", "M" + curve(S, 5, 21, X, Y).join("L"));
      const done = curve(S, 5, 21, X, Y, S.h);
      if (done.length > 1) $(".spark-line", live).setAttribute("d", "M" + done.join("L"));
    };
    render(); setInterval(render, 30000);
  }

  /* ------------------------------------------------------------------
     Savings calculator
     ------------------------------------------------------------------ */
  const calc = $("[data-calc]");
  if (calc) {
    const range = $("input[type='range']", calc), segs = $$("[data-battery]", calc);
    let battery = false;
    const out = (k) => $(`[data-out='${k}']`, calc);
    const update = () => {
      const bill = +range.value;
      range.style.setProperty("--p", ((bill - range.min) / (range.max - range.min) * 100) + "%");
      out("bill").textContent = "$" + fmt(bill) + (bill >= +range.max ? "+" : "");
      const e = WH.estimate({ bill, battery });
      out("savings").textContent = fmt(Math.round(e.savings / 10) * 10);
      out("monthly").textContent = fmt(e.savings / 12);
      out("production").textContent = fmt(e.production);
      out("co2").textContent = fmt(e.co2, 1);
      out("coverage").textContent = Math.round(e.coverage * 100);
      out("meter").style.width = Math.round(e.coverage * 100) + "%";
      out("pkg").textContent = e.pkg.name;
      out("pkgspec").textContent = `${e.pkg.panels} × 510W JA Solar · ${e.pkg.kwp} kWp${e.pkg.battery ? ` · ${e.pkg.battery} kWh SigenStor` : ""}`;
      out("link").href = `quote.html?bill=${bill}&battery=${battery ? 1 : 0}&package=${e.id}`;
    };
    range.addEventListener("input", update);
    segs.forEach((b) => b.addEventListener("click", () => { battery = b.dataset.battery === "1"; segs.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); update(); }));
    update();
  }

  /* ------------------------------------------------------------------
     Contact form
     ------------------------------------------------------------------ */
  $$("[data-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let ok = true;
      $$("[required]", form).forEach((f) => {
        const bad = !f.value.trim() || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value));
        f.closest(".input")?.classList.toggle("is-invalid", bad);
        if (bad && ok) { f.focus(); ok = false; }
      });
      if (!ok) return;
      const data = Object.fromEntries(new FormData(form));
      const btn = $("button[type='submit']", form);
      btn.disabled = true;
      await WH.submit(Object.assign({ type: "Contact form" }, data), `Website enquiry from ${data.name || "the website"}`);
      form.classList.add("is-sent");
      btn.disabled = false;
      form.reset();
    });
  });

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
