/* Watthaus Strategy — site interactions. Vanilla JS, no dependencies. */
(() => {
  "use strict";
  const d = document;
  const root = d.documentElement;
  const C = window.WH_CONFIG || {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine) and (hover: hover)").matches;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const WH = (window.WH = window.WH || {});

  /* ------------------------------------------------------------------
     Packages + savings estimate (shared by calculator and quote funnel)
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
    const coverage = clamp(savings / (bill * 12), 0, 1);
    return {
      id, pkg: p, usage, production, savings, coverage,
      selfUse: production ? selfUsed / production : 0,
      co2: production * (C.co2PerKwh || 0.102) / 1000
    };
  };

  const fmt = (n, dec = 0) => Number(n).toLocaleString("en-NZ", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  WH.fmt = fmt;

  /* ------------------------------------------------------------------
     Lead submission (quote funnel + contact form)
     ------------------------------------------------------------------ */
  WH.submit = async (payload, subject) => {
    const data = Object.assign({
      submittedAt: new Date().toISOString(),
      page: location.pathname,
      referrer: d.referrer || "",
      utm: Object.fromEntries(new URLSearchParams(location.search))
    }, payload);
    if (C.formEndpoint) {
      try {
        const r = await fetch(C.formEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data)
        });
        if (r.ok) return { ok: true, via: "endpoint" };
      } catch (e) { /* fall through to email */ }
    }
    const lines = Object.entries(payload)
      .filter(([, v]) => v !== "" && v != null)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    const href = `mailto:${C.leadEmail}?subject=${encodeURIComponent(subject || "Website enquiry")}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
    return { ok: true, via: "email" };
  };

  /* ------------------------------------------------------------------
     Loader → then start reveals
     ------------------------------------------------------------------ */
  const loader = $(".loader");
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    loader && loader.classList.add("is-done");
    try { sessionStorage.setItem("wh-seen", "1"); } catch (e) {}
    setTimeout(initReveals, loader && !root.classList.contains("no-loader") ? 350 : 0);
  };
  if (!loader || root.classList.contains("no-loader")) start();
  else {
    const t0 = performance.now();
    const go = () => setTimeout(start, Math.max(0, 1250 - (performance.now() - t0)));
    if (d.readyState === "complete") go(); else addEventListener("load", go, { once: true });
    setTimeout(start, 3200);
  }

  /* ------------------------------------------------------------------
     Split text into masked words
     ------------------------------------------------------------------ */
  function splitWords(el) {
    let i = 0;
    const wrap = (node) => {
      const w = d.createElement("span");
      w.className = "split-line split-word";
      const inner = d.createElement("span");
      inner.style.setProperty("--i", Math.min(i++, 18));
      w.appendChild(inner);
      return [w, inner];
    };
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = d.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(" ")); return; }
            const [w, inner] = wrap();
            inner.textContent = p;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          // keep gradient-text elements whole so background-clip keeps working
          if (/-text\b/.test(n.className)) {
            const [w, inner] = wrap();
            n.replaceWith(w);
            inner.appendChild(n);
          } else walk(n);
        }
      });
    };
    walk(el);
  }
  $$("[data-split]").forEach(splitWords);

  /* scrub words */
  const scrubs = $$("[data-scrub]").map((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="scrub-word">${w}</span>`).join(" ");
    return { el, words: $$(".scrub-word", el) };
  });

  /* ------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------ */
  function initReveals() {
    const els = $$("[data-reveal], [data-split], [data-count], [data-draw]");
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
    const c = el.querySelector(".fg");
    if (!c) return;
    const len = 2 * Math.PI * parseFloat(c.getAttribute("r"));
    c.style.strokeDasharray = `${len * parseFloat(el.dataset.donut) / 100} ${len}`;
  }

  function countUp(el, instant) {
    const to = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const pre = el.dataset.prefix || "";
    const suf = el.dataset.suffix || "";
    if (instant || reduce) { el.textContent = pre + fmt(to, dec) + suf; return; }
    const dur = 2000;
    const t0 = performance.now();
    const tick = (t) => {
      const p = clamp((t - t0) / dur, 0, 1);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = pre + fmt(to * e, dec) + suf;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------
     Nav, menu, mobile bar
     ------------------------------------------------------------------ */
  const nav = $("[data-nav]");
  const burger = $("[data-burger]");
  const mbar = $("[data-mbar]");
  let lastY = scrollY;
  const setMenu = (open) => {
    d.body.classList.toggle("menu-open", open);
    burger && burger.setAttribute("aria-expanded", String(open));
    burger && burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  burger && burger.addEventListener("click", () => setMenu(!d.body.classList.contains("menu-open")));
  $$("#menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ------------------------------------------------------------------
     Scroll-driven effects (one rAF loop)
     ------------------------------------------------------------------ */
  const parallax = reduce ? [] : $$("[data-parallax]");
  const hs = $("[data-hscroll]");
  const hsTrack = hs && $(".hs__track", hs);
  const hsBar = hs && $(".hs__progress span", hs);
  const hsImgs = hs ? $$(".svc__img img", hs) : [];
  let hsDist = 0;
  const hsActive = () => hs && innerWidth > 980 && !reduce;
  const sizeHs = () => {
    if (!hs) return;
    if (!hsActive()) { hs.style.height = ""; hsTrack.style.transform = ""; return; }
    hsDist = Math.max(0, hsTrack.scrollWidth - innerWidth);
    hs.style.height = `${hsDist + innerHeight}px`;
  };
  sizeHs();
  addEventListener("resize", sizeHs);
  addEventListener("load", sizeHs);

  let ticking = false;
  const onScroll = () => {
    const y = scrollY;
    if (nav) {
      nav.classList.toggle("is-scrolled", y > 20);
      if (!d.body.classList.contains("menu-open") && !d.body.classList.contains("q-body")) {
        if (y > lastY + 6 && y > 500) nav.classList.add("is-hidden");
        else if (y < lastY - 6 || y < 200) nav.classList.remove("is-hidden");
      }
    }
    mbar && mbar.classList.toggle("is-on", y > innerHeight * 0.6);
    lastY = y;

    const vh = innerHeight;
    parallax.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const s = parseFloat(el.dataset.parallax) || 0.15;
      const off = (r.top + r.height / 2 - vh / 2) * -s;
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    });

    scrubs.forEach(({ el, words }) => {
      const r = el.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("is-on", i < n));
    });

    if (hsActive()) {
      const r = hs.getBoundingClientRect();
      const p = clamp(-r.top / (hs.offsetHeight - vh), 0, 1);
      hsTrack.style.transform = `translate3d(${(-p * hsDist).toFixed(1)}px, 0, 0)`;
      if (hsBar) hsBar.style.transform = `scaleX(${p})`;
      hsImgs.forEach((img) => {
        const b = img.parentElement.getBoundingClientRect();
        const o = ((b.left + b.width / 2) - innerWidth / 2) / innerWidth;
        img.style.transform = `scale(1.15) translate3d(${(o * -8).toFixed(2)}%, 0, 0)`;
      });
    }
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
     Cursor + magnetic buttons
     ------------------------------------------------------------------ */
  if (fine && !reduce) {
    root.classList.add("has-cursor");
    const cur = $(".cursor");
    const ring = $(".cursor__ring", cur);
    const dot = $(".cursor__dot", cur);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`; }, { passive: true });
    const loop = () => {
      rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
    d.addEventListener("mouseover", (e) => {
      const v = e.target.closest("[data-cursor='view']");
      const l = e.target.closest("a, button, [role='tab'], input[type='range'], label, summary");
      cur.classList.toggle("is-view", !!v);
      cur.classList.toggle("is-link", !v && !!l);
    });
    d.addEventListener("mouseleave", () => cur.style.opacity = "0");
    d.addEventListener("mouseenter", () => cur.style.opacity = "1");

    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ------------------------------------------------------------------
     Toggle groups (package sets)
     ------------------------------------------------------------------ */
  $$("[data-toggle]").forEach((group) => {
    const btns = $$("button", group);
    const pill = $(".toggle__pill", group);
    const scope = group.closest("[data-toggle-scope]") || d;
    const place = (b) => { if (pill) { pill.style.width = `${b.offsetWidth}px`; pill.style.transform = `translateX(${b.offsetLeft - 5}px)`; } };
    const select = (b) => {
      btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      place(b);
      $$("[data-set]", scope).forEach((s) => s.classList.toggle("is-active", s.dataset.set === b.dataset.target));
    };
    btns.forEach((b) => b.addEventListener("click", () => select(b)));
    const init = btns.find((b) => b.getAttribute("aria-pressed") === "true") || btns[0];
    requestAnimationFrame(() => place(init));
    addEventListener("resize", () => place(btns.find((b) => b.getAttribute("aria-pressed") === "true") || init));
    d.fonts && d.fonts.ready.then(() => place(btns.find((b) => b.getAttribute("aria-pressed") === "true") || init));
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
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => show(t));
      t.addEventListener("keydown", (e) => {
        const k = e.key;
        if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(k)) {
          e.preventDefault();
          const n = (i + (k === "ArrowDown" || k === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          show(tabs[n], true);
        }
      });
    });
    const hash = location.hash.slice(1);
    const fromHash = tabs.find((t) => t.dataset.key === hash);
    if (fromHash) show(fromHash);
  });

  /* ------------------------------------------------------------------
     Accordions with smooth height
     ------------------------------------------------------------------ */
  $$(".acc details").forEach((det) => {
    const sum = $("summary", det);
    const body = $(".acc__body", det);
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
        const h = body.scrollHeight;
        const a = body.animate([{ height: "0px", opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 550, easing: "cubic-bezier(.22,1,.36,1)" });
        a.onfinish = () => delete det.dataset.anim;
      }
    });
  });

  /* ------------------------------------------------------------------
     Hero light canvas — drifting motes + sun glow that follows the pointer
     ------------------------------------------------------------------ */
  const cv = $("[data-hero-canvas]");
  if (cv && !reduce) {
    const ctx = cv.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, motes = [], running = true, t = 0;
    let tx = 0.74, ty = 0.16, sx = tx, sy = ty, hasPointer = false;
    const size = () => {
      const r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = w < 700 ? 28 : 64;
      motes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.8 + 0.4,
        v: Math.random() * 0.35 + 0.08,
        p: Math.random() * Math.PI * 2,
        a: Math.random() * 0.5 + 0.2
      }));
    };
    size();
    addEventListener("resize", size);
    cv.parentElement.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; hasPointer = true;
    });
    cv.parentElement.addEventListener("pointerleave", () => { hasPointer = false; });
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) requestAnimationFrame(draw); }).observe(cv);
    function draw() {
      if (!running || d.hidden) return;
      t += 0.006;
      if (!hasPointer) { tx = 0.74 + Math.sin(t) * 0.06; ty = 0.16 + Math.cos(t * 0.8) * 0.04; }
      sx = lerp(sx, tx, 0.05); sy = lerp(sy, ty, 0.05);
      const gx = sx * w, gy = sy * h;
      ctx.clearRect(0, 0, w, h);
      const R = Math.max(w, h) * 0.55;
      let g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R);
      g.addColorStop(0, "rgba(255, 226, 160, 0.42)");
      g.addColorStop(0.12, "rgba(248, 200, 110, 0.20)");
      g.addColorStop(0.4, "rgba(217, 122, 43, 0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // lens flare ghosts toward the centre
      const cx = w / 2, cy = h / 2;
      [[0.45, 26, 0.08], [0.8, 54, 0.05], [1.25, 90, 0.04], [1.5, 14, 0.12]].forEach(([k, r, a]) => {
        const fx = gx + (cx - gx) * k * 1.2, fy = gy + (cy - gy) * k * 1.2;
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        fg.addColorStop(0, `rgba(248, 217, 143, ${a})`);
        fg.addColorStop(1, "rgba(248, 217, 143, 0)");
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
      });
      motes.forEach((m) => {
        m.y -= m.v; m.x += Math.sin(t * 3 + m.p) * 0.25;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        const dist = Math.hypot(m.x - gx, m.y - gy) / R;
        const a = m.a * (0.35 + Math.max(0, 1 - dist)) * (0.6 + 0.4 * Math.sin(t * 4 + m.p));
        ctx.fillStyle = `rgba(255, 230, 180, ${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    d.addEventListener("visibilitychange", () => { if (!d.hidden && running) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  /* ------------------------------------------------------------------
     Live sun dashboard — real Auckland time, sample 10.12 kW system
     ------------------------------------------------------------------ */
  const dash = $("[data-sun-dash]");
  if (dash) {
    const KWP = 10.12;
    // approx. local sunrise / sunset (decimal hours, incl. daylight saving) per month
    const SUN = [[6.2, 20.7], [6.75, 20.25], [7.25, 19.7], [6.9, 18.2], [7.2, 17.4], [7.5, 17.2], [7.5, 17.3], [7.1, 17.75], [6.6, 18.5], [6.7, 19.6], [6.1, 20.1], [5.95, 20.55]];
    const SEASON = [1, 0.95, 0.85, 0.72, 0.6, 0.55, 0.57, 0.66, 0.78, 0.88, 0.96, 1];
    const X0 = 4, X1 = 22, W = 600, H = 240, B = 200, T = 30;
    const maxP = KWP * 0.55;
    const xOf = (hr) => 20 + (hr - X0) / (X1 - X0) * (W - 40);
    const yOf = (kw) => B - kw / maxP * (B - T);
    const svg = $("svg", dash);
    const ghost = $(".curve-ghost", svg), curve = $(".curve", svg), area = $(".area", svg);
    const sun = $(".sun", svg), halo = $(".sun-halo", svg);

    const nzNow = () => {
      const parts = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", minute: "numeric", month: "numeric", hourCycle: "h23" })
        .formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
      return { h: +parts.hour + +parts.minute / 60, m: +parts.month - 1, hh: +parts.hour, mm: parts.minute };
    };
    const render = () => {
      const now = nzNow();
      const [rise, set] = SUN[now.m];
      const peak = maxP * SEASON[now.m];
      const P = (hr) => (hr <= rise || hr >= set) ? 0 : peak * Math.pow(Math.sin(Math.PI * (hr - rise) / (set - rise)), 1.3);
      const pts = [], done = [];
      let total = 0, sofar = 0;
      const step = 0.05;
      for (let hr = X0; hr <= X1 + 1e-6; hr += step) {
        const kw = P(hr);
        pts.push(`${xOf(hr).toFixed(1)},${yOf(kw).toFixed(1)}`);
        total += kw * step;
        if (hr <= now.h) { sofar += kw * step; done.push(`${xOf(hr).toFixed(1)},${yOf(kw).toFixed(1)}`); }
      }
      ghost.setAttribute("d", "M" + pts.join("L"));
      if (done.length > 1) {
        curve.setAttribute("d", "M" + done.join("L"));
        const lastX = done[done.length - 1].split(",")[0];
        area.setAttribute("d", `M${xOf(X0)},${B}L${done.join("L")}L${lastX},${B}Z`);
      }
      const nowKw = P(now.h);
      const day = now.h > rise && now.h < set;
      const sx = xOf(clamp(now.h, X0, X1)), sy = yOf(nowKw);
      sun.setAttribute("cx", sx); sun.setAttribute("cy", sy);
      halo.setAttribute("cx", sx); halo.setAttribute("cy", sy);
      sun.style.opacity = halo.style.opacity = day ? 1 : 0;
      const h12 = ((now.hh + 11) % 12) + 1;
      $("[data-dash-time]", dash).textContent = `${h12}:${now.mm}${now.hh < 12 ? "am" : "pm"}`;
      $("[data-dash-kw]", dash).textContent = fmt(nowKw, 1);
      $("[data-dash-kwh]", dash).textContent = fmt(sofar, 1);
      $("[data-dash-save]", dash).textContent = "$" + fmt(sofar * 0.3, 2);
      $("[data-dash-total]", dash).textContent = fmt(total, 0);
      $("[data-dash-state]", dash).textContent = day
        ? (now.h < rise + 1.5 ? "Sun's just up — panels are waking" : now.h > set - 1.5 ? "Golden hour — topping up the battery" : "Panels generating, battery charging")
        : (now.h >= set ? "Sun's down — the battery is running the house" : "Before sunrise — running on stored sunshine");
    };
    render();
    setInterval(render, 30000);
  }

  /* ------------------------------------------------------------------
     Savings calculator (solar page)
     ------------------------------------------------------------------ */
  const calc = $("[data-calc]");
  if (calc) {
    const range = $("input[type='range']", calc);
    const segs = $$("[data-battery]", calc);
    let battery = false;
    const out = (k) => $(`[data-out='${k}']`, calc);
    const update = () => {
      const bill = +range.value;
      const pct = (bill - range.min) / (range.max - range.min) * 100;
      range.style.setProperty("--p", pct + "%");
      out("bill").textContent = "$" + fmt(bill) + (bill >= +range.max ? "+" : "");
      const e = WH.estimate({ bill, battery });
      out("savings").textContent = "$" + fmt(Math.round(e.savings / 10) * 10);
      out("monthly").textContent = "$" + fmt(e.savings / 12);
      out("production").textContent = fmt(e.production);
      out("co2").textContent = fmt(e.co2, 1);
      out("coverage").textContent = Math.round(e.coverage * 100) + "%";
      out("meter").style.width = Math.round(e.coverage * 100) + "%";
      out("pkg").textContent = e.pkg.name;
      out("pkgspec").textContent = `${e.pkg.panels} × 510W JA Solar · ${e.pkg.kwp} kWp${e.pkg.battery ? ` · ${e.pkg.battery}kWh SigenStor` : ""}`;
      out("link").href = `quote.html?bill=${bill}&battery=${battery ? 1 : 0}&package=${e.id}`;
    };
    range.addEventListener("input", update);
    segs.forEach((b) => b.addEventListener("click", () => {
      battery = b.dataset.battery === "1";
      segs.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      update();
    }));
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

  /* footer year */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
