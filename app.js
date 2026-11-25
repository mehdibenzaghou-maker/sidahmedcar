// ===================================================
// SIDAHMED CAR — public site
// ===================================================
(async function () {
  const SC = window.SC;
  const { esc, safeUrl } = SC;
  const $ = id => document.getElementById(id);

  let sections = [], cars = [], settings = {};
  const state = { q: "", section: "", year: "", fuel: "", trans: "", maxPrice: "", maxKm: "" };

  $("year").textContent = new Date().getFullYear();

  try {
    await SC.init();
    ({ sections, cars, settings } = await SC.loadAll());
  } catch (e) {
    console.error(e);
    $("carList").innerHTML = '<p class="empty">Impossible de charger les véhicules pour le moment.</p>';
    return;
  }

  // ---------- helpers ----------
  const sectionName = c => (sections.find(s => s.id === c.sectionId) || {}).name || "Autres";
  const fmtPrice = p => Number(p).toLocaleString("fr-FR") + " DA";
  const fmtKm = k => Number(k).toLocaleString("fr-FR") + " km";
  const hasNum = v => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
  const phoneHref = p => "tel:" + String(p).replace(/[^\d+]/g, "");
  const waHref = p => {
    let d = String(p).replace(/\D/g, "");
    if (d.startsWith("0")) d = "213" + d.slice(1);
    return "https://wa.me/" + d;
  };
  const uniq = arr => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ""))];

  // ---------- hero / contact from settings ----------
  function applySettings() {
    const heroImg = safeUrl(settings.heroImage) || safeUrl(((cars[0] || {}).photos || [])[0]);
    if (heroImg) $("heroMedia").innerHTML = `<img src="${heroImg}" alt="">`;

    if (settings.phone) {
      const href = phoneHref(settings.phone);
      [["headerPhone", true], ["navPhone", true], ["heroCall", false], ["contactPhone", false]].forEach(([id, showNum]) => {
        const el = $(id); el.href = href; el.hidden = false;
        if (id !== "heroCall") el.textContent = settings.phone;
      });
    }
    if (settings.whatsapp) { $("contactWa").href = waHref(settings.whatsapp); $("contactWa").hidden = false; }
    if (settings.address) {
      $("contactAddress").textContent = settings.address;
      $("contactMap").innerHTML =
        `<iframe title="Localisation" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed"></iframe>`;
      $("contactMap").hidden = false;
    }
    if (settings.phone || settings.whatsapp || settings.address) {
      $("contact").hidden = false; $("navContact").hidden = false;
    }
  }

  // ---------- filters ----------
  function fillSelect(id, placeholder, options) {
    $(id).innerHTML = `<option value="">${placeholder}</option>` +
      options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  }
  function buildFilterOptions() {
    const usedSections = sections.filter(s => cars.some(c => c.sectionId === s.id));
    fillSelect("fSection", "Toutes", usedSections.map(s => ({ value: s.id, label: s.name })));
    fillSelect("fYear", "Toutes", uniq(cars.map(c => c.year)).sort((a, b) => b - a).map(y => ({ value: y, label: y })));
    fillSelect("fFuel", "Tous", uniq(cars.map(c => c.fuel)).sort().map(v => ({ value: v, label: v })));
    fillSelect("fTrans", "Toutes", uniq(cars.map(c => c.transmission)).sort().map(v => ({ value: v, label: v })));
  }

  function matches(c) {
    if (state.section && c.sectionId !== state.section) return false;
    if (state.year && String(c.year) !== state.year) return false;
    if (state.fuel && c.fuel !== state.fuel) return false;
    if (state.trans && c.transmission !== state.trans) return false;
    if (state.maxPrice) { if (!hasNum(c.price) || Number(c.price) > Number(state.maxPrice)) return false; }
    if (state.maxKm) { if (!hasNum(c.mileage) || Number(c.mileage) > Number(state.maxKm)) return false; }
    if (state.q) {
      const hay = [sectionName(c), c.name, c.year, c.fuel, c.transmission, c.color]
        .concat((c.specs || []).map(s => s.value)).join(" ").toLowerCase();
      return state.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
    }
    return true;
  }

  function activeFilterCount() {
    return ["section", "year", "fuel", "trans", "maxPrice", "maxKm"].filter(k => state[k]).length;
  }

  // ---------- render ----------
  function cardHTML(c) {
    const photo = safeUrl((c.photos || [])[0]);
    const chips = [c.fuel, c.transmission, hasNum(c.mileage) ? fmtKm(c.mileage) : ""].filter(Boolean)
      .map(t => `<span>${esc(t)}</span>`).join("");
    return `
      <article class="car-card" data-id="${esc(c.id)}" tabindex="0" role="button" aria-label="Voir la fiche ${esc(sectionName(c))} ${esc(c.name)}">
        <div class="car-card-media">
          ${c.year ? `<span class="car-card-year">${esc(c.year)}</span>` : ""}
          ${photo ? `<img src="${photo}" alt="${esc(sectionName(c))} ${esc(c.name)}" loading="lazy">` : `<div class="no-photo">CAR</div>`}
        </div>
        <div class="car-card-body">
          <h3 class="car-card-name">${esc(c.name)}</h3>
          <div class="car-card-brand">${esc(sectionName(c))}</div>
          ${chips ? `<div class="chips">${chips}</div>` : ""}
          <div class="car-card-foot">
            ${hasNum(c.price) ? `<span class="price">${fmtPrice(c.price)}</span>` : `<span class="price on-request">Prix sur demande</span>`}
            <span class="cta">Voir la fiche →</span>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const list = cars.filter(matches);
    const bySection = new Map();
    list.forEach(c => {
      const key = sections.some(s => s.id === c.sectionId) ? c.sectionId : "__other";
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key).push(c);
    });

    const blocks = [];
    sections.forEach(s => { if (bySection.has(s.id)) blocks.push({ id: s.id, name: s.name, cars: bySection.get(s.id) }); });
    if (bySection.has("__other")) blocks.push({ id: "__other", name: "Autres", cars: bySection.get("__other") });

    $("carList").innerHTML = blocks.length
      ? blocks.map(b => `
          <section class="section-block" id="sec-${esc(b.id)}">
            <div class="section-head">
              <h2 class="section-name">${esc(b.name)}</h2>
              <span class="section-count">${b.cars.length} véhicule${b.cars.length > 1 ? "s" : ""}</span>
            </div>
            <div class="cars-grid">${b.cars.map(cardHTML).join("")}</div>
          </section>`).join("")
      : `<p class="empty">${cars.length ? "Aucun véhicule ne correspond à votre recherche." : "Aucun véhicule pour le moment."}</p>`;

    $("resultCount").textContent = cars.length
      ? `${list.length} véhicule${list.length > 1 ? "s" : ""} affiché${list.length > 1 ? "s" : ""}` : "";

    const n = activeFilterCount();
    $("filterCount").hidden = n === 0;
    $("filterCount").textContent = n;

    $("carList").querySelectorAll(".car-card").forEach(el => {
      el.addEventListener("click", () => openCar(el.dataset.id));
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCar(el.dataset.id); } });
    });
  }

  function renderChipsAndMarquee() {
    const used = sections.filter(s => cars.some(c => c.sectionId === s.id));
    $("sectionChips").innerHTML = used.map(s => `<button class="chip" data-sec="${esc(s.id)}">${esc(s.name)}</button>`).join("");
    $("sectionChips").querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
      state.section = ""; $("fSection").value = ""; render();
      const t = document.getElementById("sec-" + b.dataset.sec);
      if (t) t.scrollIntoView({ behavior: "smooth" });
    }));
    if (used.length) {
      const txt = used.map(s => esc(s.name.toUpperCase())).join("&nbsp;&nbsp;•&nbsp;&nbsp;") + "&nbsp;&nbsp;•&nbsp;&nbsp;";
      $("marqueeTrack").innerHTML = `<span>${txt.repeat(3)}</span><span>${txt.repeat(3)}</span>`;
      $("marquee").hidden = false;
    }
  }

  // ---------- detail overlay (no new page) ----------
  const overlay = $("carOverlay"), content = $("overlayContent");
  let pushed = false;

  function openCar(id, push = true) {
    const c = cars.find(x => x.id === id);
    if (!c) return;
    const photos = (c.photos || []).map(safeUrl).filter(Boolean);
    const video = safeUrl(c.video);
    const media = [];
    if (video) media.push({ type: "video", src: video });
    photos.forEach(p => media.push({ type: "image", src: p }));

    const rows = [
      ["Marque", sectionName(c)], ["Modèle", c.name], ["Année", c.year], ["Carburant", c.fuel],
      ["Boîte de vitesses", c.transmission], ["Kilométrage", hasNum(c.mileage) ? fmtKm(c.mileage) : ""],
      ["Couleur", c.color], ["Prix", hasNum(c.price) ? fmtPrice(c.price) : ""]
    ].concat((c.specs || []).map(s => [s.label, s.value])).filter(r => r[1] !== "" && r[1] != null);

    const phone = settings.phone, wa = settings.whatsapp;
    content.innerHTML = `
      <h2 class="detail-title"><small>${esc(sectionName(c))}${c.year ? " · " + esc(c.year) : ""}</small>${esc(c.name)}</h2>
      ${media.length ? `
      <div class="detail-gallery">
        <div class="main-media" id="mainMedia"></div>
        <div class="thumb-col" id="thumbCol"></div>
      </div>` : ""}
      <div class="detail-body">
        <table class="spec-table">${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")}</table>
        <aside class="detail-side">
          ${hasNum(c.price) ? `<div class="big-price">${fmtPrice(c.price)}</div>` : ""}
          <h3>Intéressé ?</h3>
          <p>Contactez-nous pour organiser un essai ou obtenir plus d'informations.</p>
          ${phone ? `<a class="btn btn-primary" href="${esc(phoneHref(phone))}">Appeler ${esc(phone)}</a>` : ""}
          ${wa ? `<a class="btn btn-ghost" href="${esc(waHref(wa))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${!phone && !wa ? `<a class="btn btn-ghost" href="#" data-close>Retour aux véhicules</a>` : ""}
        </aside>
      </div>`;

    if (media.length) {
      const main = $("mainMedia"), thumbs = $("thumbCol");
      const show = m => {
        main.innerHTML = m.type === "video"
          ? `<video src="${m.src}" controls playsinline preload="metadata"></video>`
          : `<img src="${m.src}" alt="${esc(c.name)}">`;
      };
      thumbs.innerHTML = media.map((m, i) =>
        `<button class="thumb ${m.type === "video" ? "video-thumb" : ""} ${i === 0 ? "active" : ""}" data-i="${i}" aria-label="Média ${i + 1}">
           <img src="${m.type === "video" ? (photos[0] || "") : m.src}" alt="">
         </button>`).join("");
      thumbs.querySelectorAll(".thumb").forEach(t => t.addEventListener("click", () => {
        thumbs.querySelectorAll(".thumb").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        show(media[Number(t.dataset.i)]);
      }));
      show(media[0]);
    }

    content.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); closeOverlay(); }));
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    overlay.querySelector(".overlay-scroll").scrollTop = 0;
    if (push) { history.pushState({ car: id }, "", "#car-" + id); pushed = true; }
  }

  function hideOverlay() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    content.innerHTML = ""; // stops any playing video
    if (/^#car-/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  }
  function closeOverlay() {
    if (pushed) { pushed = false; history.back(); } else hideOverlay();
  }

  $("overlayClose").addEventListener("click", closeOverlay);
  overlay.addEventListener("click", e => { if (e.target === overlay || e.target.classList.contains("overlay-scroll")) closeOverlay(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && overlay.classList.contains("is-open")) closeOverlay(); });
  window.addEventListener("popstate", () => {
    const m = location.hash.match(/^#car-(.+)$/);
    if (m) openCar(decodeURIComponent(m[1]), false); else hideOverlay();
  });

  // ---------- wire up UI ----------
  let t;
  $("searchInput").addEventListener("input", e => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 120);
  });
  $("filterBtn").addEventListener("click", () => {
    const open = $("filterPanel").hidden;
    $("filterPanel").hidden = !open;
    $("filterBtn").setAttribute("aria-expanded", String(open));
  });
  [["fSection", "section"], ["fYear", "year"], ["fFuel", "fuel"], ["fTrans", "trans"], ["fPrice", "maxPrice"], ["fKm", "maxKm"]]
    .forEach(([id, key]) => $(id).addEventListener("input", e => { state[key] = e.target.value; render(); }));
  $("resetBtn").addEventListener("click", () => {
    ["fSection", "fYear", "fFuel", "fTrans", "fPrice", "fKm"].forEach(id => ($(id).value = ""));
    ["section", "year", "fuel", "trans", "maxPrice", "maxKm"].forEach(k => (state[k] = ""));
    render();
  });

  const burger = $("burgerBtn"), nav = $("mainNav");
  const closeNav = () => { nav.classList.remove("is-open"); burger.classList.remove("is-active"); burger.setAttribute("aria-expanded", "false"); };
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.classList.toggle("is-active", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", e => { if (e.target.closest("a")) closeNav(); });

  // ---------- init ----------
  applySettings();
  buildFilterOptions();
  renderChipsAndMarquee();
  render();
  const m = location.hash.match(/^#car-(.+)$/);
  if (m) openCar(decodeURIComponent(m[1]), false);
})();
