// ===================================================
// SIDAHMED CAR — public site
// ===================================================
(async function () {
  const SC = window.SC;
  const { esc, safeUrl, fmtPrice } = SC;
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
  // fmtPrice comes from data.js (prices are stored in millions)
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
  const phones = SC.phonesOf(settings);
  function applySettings() {
    const heroImg = safeUrl(settings.heroImage) || safeUrl(((cars[0] || {}).photos || [])[0]);
    if (heroImg) $("heroMedia").innerHTML = `<img src="${heroImg}" alt="">`;

    if (phones.length) {
      const href = phoneHref(phones[0]);
      ["headerPhone", "navPhone", "heroCall"].forEach(id => {
        const el = $(id); el.href = href; el.hidden = false;
        if (id !== "heroCall") el.textContent = phones[0];
      });
      $("contactPhones").innerHTML = phones.map((p, i) =>
        `<a class="btn ${i === 0 ? "btn-primary" : "btn-ghost"}" href="${esc(phoneHref(p))}">${esc(p)}</a>`).join("");
    }
    if (settings.whatsapp) { $("contactWa").href = waHref(settings.whatsapp); $("contactWa").hidden = false; }

    const address = settings.address || SC.DEFAULT_ADDRESS;
    $("contactAddress").textContent = address;
    $("contactMap").innerHTML =
      `<iframe title="Localisation" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed"></iframe>`;
    $("contactMap").hidden = false;
    $("contactMapLink").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
    $("contactMapLink").hidden = false;
    $("contact").hidden = false; $("navContact").hidden = false;
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

  const PER_PAGE = 8; // cars shown per page — change this number to show more/less
  let page = 1;
  let ordered = []; // filtered cars, in display order (brand sections first to last)

  const secKey = c => (sections.some(s => s.id === c.sectionId) ? c.sectionId : "__other");
  function orderedList() {
    const list = cars.filter(matches);
    const out = [];
    sections.forEach(s => list.forEach(c => { if (c.sectionId === s.id) out.push(c); }));
    list.forEach(c => { if (!sections.some(s => s.id === c.sectionId)) out.push(c); });
    return out;
  }

  function renderPagination(totalPages) {
    const nav = $("pagination");
    if (totalPages <= 1) { nav.hidden = true; nav.innerHTML = ""; return; }
    const nums = [];
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== "…") nums.push("…");
    }
    nav.innerHTML =
      `<button class="pg-btn" data-p="${page - 1}" ${page === 1 ? "disabled" : ""}>‹ Précédent</button>` +
      nums.map(n => n === "…"
        ? `<span class="pg-dots">…</span>`
        : `<button class="pg-btn pg-num ${n === page ? "is-current" : ""}" data-p="${n}" ${n === page ? 'aria-current="page"' : ""}>${n}</button>`).join("") +
      `<span class="pg-info">Page ${page} / ${totalPages}</span>` +
      `<button class="pg-btn" data-p="${page + 1}" ${page === totalPages ? "disabled" : ""}>Suivant ›</button>`;
    nav.hidden = false;
  }

  function render() {
    ordered = orderedList();
    const totalPages = Math.max(1, Math.ceil(ordered.length / PER_PAGE));
    page = Math.min(Math.max(page, 1), totalPages);
    const slice = ordered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const totals = {};
    ordered.forEach(c => { const k = secKey(c); totals[k] = (totals[k] || 0) + 1; });
    const blocks = [];
    slice.forEach(c => {
      const k = secKey(c), last = blocks[blocks.length - 1];
      if (last && last.id === k) last.cars.push(c);
      else blocks.push({ id: k, name: k === "__other" ? "Autres" : sectionName(c), cars: [c] });
    });

    $("carList").innerHTML = blocks.length
      ? blocks.map(b => `
          <section class="section-block" id="sec-${esc(b.id)}">
            <div class="section-head">
              <h2 class="section-name">${esc(b.name)}</h2>
              <span class="section-count">${totals[b.id]} véhicule${totals[b.id] > 1 ? "s" : ""}</span>
            </div>
            <div class="cars-grid">${b.cars.map(cardHTML).join("")}</div>
          </section>`).join("")
      : `<p class="empty">${cars.length ? "Aucun véhicule ne correspond à votre recherche." : "Aucun véhicule pour le moment."}</p>`;

    $("resultCount").textContent = cars.length
      ? `${ordered.length} véhicule${ordered.length > 1 ? "s" : ""} trouvé${ordered.length > 1 ? "s" : ""}` +
        (totalPages > 1 ? ` · page ${page}/${totalPages}` : "")
      : "";
    renderPagination(totalPages);

    const n = activeFilterCount();
    $("filterCount").hidden = n === 0;
    $("filterCount").textContent = n;

    $("carList").querySelectorAll(".car-card").forEach(el => {
      el.addEventListener("click", () => openCar(el.dataset.id));
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCar(el.dataset.id); } });
    });
  }

  $("pagination").addEventListener("click", e => {
    const b = e.target.closest("[data-p]");
    if (!b || b.disabled) return;
    page = Number(b.dataset.p);
    render();
    $("carList").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function renderChipsAndMarquee() {
    const used = sections.filter(s => cars.some(c => c.sectionId === s.id));
    $("sectionChips").innerHTML = used.map(s => `<button class="chip" data-sec="${esc(s.id)}">${esc(s.name)}</button>`).join("");
    $("sectionChips").querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
      state.section = ""; $("fSection").value = "";
      ordered = orderedList();
      const idx = ordered.findIndex(c => c.sectionId === b.dataset.sec);
      if (idx >= 0) page = Math.floor(idx / PER_PAGE) + 1;
      render();
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

    const wa = settings.whatsapp;
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
          ${phones.map((p, i) => `<a class="btn ${i === 0 ? "btn-primary" : "btn-ghost"}" href="${esc(phoneHref(p))}">Appeler ${esc(p)}</a>`).join("")}
          ${wa ? `<a class="btn btn-ghost" href="${esc(waHref(wa))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${!phones.length && !wa ? `<a class="btn btn-ghost" href="#" data-close>Retour aux véhicules</a>` : ""}
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
    t = setTimeout(() => { state.q = e.target.value.trim(); page = 1; render(); }, 120);
  });
  $("filterBtn").addEventListener("click", () => {
    const open = $("filterPanel").hidden;
    $("filterPanel").hidden = !open;
    $("filterBtn").setAttribute("aria-expanded", String(open));
  });
  [["fSection", "section"], ["fYear", "year"], ["fFuel", "fuel"], ["fTrans", "trans"], ["fPrice", "maxPrice"], ["fKm", "maxKm"]]
    .forEach(([id, key]) => $(id).addEventListener("input", e => { state[key] = e.target.value; page = 1; render(); }));
  $("resetBtn").addEventListener("click", () => {
    ["fSection", "fYear", "fFuel", "fTrans", "fPrice", "fKm"].forEach(id => ($(id).value = ""));
    ["section", "year", "fuel", "trans", "maxPrice", "maxKm"].forEach(k => (state[k] = ""));
    page = 1;
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
})();    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), isError ? 4500 : 2600);
  }
  const hasNum = v => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
  const sectionName = id => (sections.find(s => s.id === id) || {}).name || "—";

  async function refresh() {
    try {
      ({ sections, cars, settings } = await SC.loadAll());
    } catch (e) {
      console.error(e);
      toast("Chargement impossible. Vérifie la connexion et les règles Firestore.", true);
      return;
    }
    renderCars(); renderSections(); fillSettings();
    $("countCars").textContent = cars.length ? "(" + cars.length + ")" : "";
    $("countSections").textContent = sections.length ? "(" + sections.length + ")" : "";
  }

  // ---------- auth ----------
  try { await SC.init(); } catch (e) { console.error(e); toast("Erreur d'initialisation Firebase.", true); }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    $("loginError").hidden = true;
    $("loginBtn").disabled = true;
    try {
      await SC.login($("loginEmail").value.trim(), $("loginPw").value);
    } catch (err) {
      $("loginError").textContent = "Email ou mot de passe incorrect.";
      $("loginError").hidden = false;
    }
    $("loginBtn").disabled = false;
  });
  $("logoutBtn").addEventListener("click", () => SC.logout());

  SC.onAuth(async user => {
    if (user) {
      $("login").hidden = true; $("app").hidden = false;
      $("admUser").textContent = user.email || "";
      $("demoBanner").hidden = !SC.demoMode;
      await refresh();
    } else {
      $("app").hidden = true; $("login").hidden = false;
      $("loginPw").value = "";
    }
  });

  $("resetDemo").addEventListener("click", async () => {
    if (!confirm("Remettre les données de démonstration ?")) return;
    SC.resetDemo(); await refresh(); toast("Démo réinitialisée");
  });

  // ---------- tabs ----------
  $("tabs").addEventListener("click", e => {
    const b = e.target.closest(".tab"); if (!b) return;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("is-active", t === b));
    ["cars", "sections", "settings"].forEach(n => ($("tab-" + n).hidden = n !== b.dataset.tab));
  });
  function gotoTab(name) { document.querySelector(`.tab[data-tab="${name}"]`).click(); }

  // ---------- cars list ----------
  function renderCars() {
    const q = $("carSearch").value.trim().toLowerCase();
    const list = cars.filter(c => !q || [sectionName(c.sectionId), c.name, c.year].join(" ").toLowerCase().includes(q));
    $("carsList").innerHTML = list.map(c => {
      const ph = safeUrl((c.photos || [])[0]);
      return `
        <div class="row" data-id="${esc(c.id)}">
          ${ph ? `<img class="row-thumb" src="${ph}" alt="" loading="lazy">` : `<div class="row-thumb">CAR</div>`}
          <div>
            <div class="row-title">${esc(sectionName(c.sectionId))} ${esc(c.name)}</div>
            <div class="row-sub">${esc(c.year || "")}${hasNum(c.price) ? " · " + SC.fmtPrice(c.price) : ""} · ${(c.photos || []).length} photo(s)${c.video ? " · vidéo" : ""}</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-act="edit">Modifier</button>
            <button class="btn btn-danger btn-sm" data-act="del">Supprimer</button>
          </div>
        </div>`;
    }).join("");
  }
  $("carSearch").addEventListener("input", renderCars);
  $("carsList").addEventListener("click", async e => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = btn.closest(".row").dataset.id;
    const car = cars.find(c => c.id === id); if (!car) return;
    if (btn.dataset.act === "edit") openCarForm(car);
    if (btn.dataset.act === "del") {
      if (!confirm(`Supprimer ${sectionName(car.sectionId)} ${car.name} ?`)) return;
      try { await SC.deleteCar(id); toast("Voiture supprimée"); await refresh(); }
      catch (err) { console.error(err); toast("Suppression impossible.", true); }
    }
  });
  $("addCarBtn").addEventListener("click", () => openCarForm(null));

  // ---------- sections ----------
  function renderSections() {
    $("sectionsList").innerHTML = sections.map(s => {
      const n = cars.filter(c => c.sectionId === s.id).length;
      return `
        <div class="row sec-row" data-id="${esc(s.id)}">
          <div>
            <div class="row-title">${esc(s.name)}</div>
            <div class="row-sub">${n} voiture${n > 1 ? "s" : ""}</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-act="rename">Renommer</button>
            <button class="btn btn-danger btn-sm" data-act="del">Supprimer</button>
          </div>
        </div>`;
    }).join("");
  }
  $("sectionForm").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("sectionName").value.trim();
    if (!name) return;
    if (sections.some(s => s.name.toLowerCase() === name.toLowerCase())) { toast("Cette section existe déjà.", true); return; }
    try { await SC.addSection(name); $("sectionName").value = ""; toast("Section ajoutée"); await refresh(); }
    catch (err) { console.error(err); toast("Ajout impossible.", true); }
  });
  $("sectionsList").addEventListener("click", async e => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = btn.closest(".row").dataset.id;
    const sec = sections.find(s => s.id === id); if (!sec) return;
    try {
      if (btn.dataset.act === "rename") {
        const name = (prompt("Nouveau nom de la section :", sec.name) || "").trim();
        if (!name || name === sec.name) return;
        await SC.renameSection(id, name); toast("Section renommée"); await refresh();
      } else {
        const n = cars.filter(c => c.sectionId === id).length;
        if (n) { toast(`Impossible : ${n} voiture(s) dans cette section. Supprime-les ou change leur section d'abord.`, true); return; }
        if (!confirm(`Supprimer la section ${sec.name} ?`)) return;
        await SC.deleteSection(id); toast("Section supprimée"); await refresh();
      }
    } catch (err) { console.error(err); toast("Action impossible.", true); }
  });

  // ---------- settings ----------
  function phoneRowHTML(v) {
    return `<div class="media-row">
      <span class="media-n"></span>
      <input class="input phone-in" type="tel" inputmode="tel" placeholder="Ex : 0555 12 34 56" value="${esc(v || "")}">
      <button type="button" class="x-btn" data-rm-phone aria-label="Retirer">&times;</button>
    </div>`;
  }
  function renumberPhones() {
    document.querySelectorAll("#phoneRows .media-n").forEach((el, i) => (el.textContent = i + 1));
  }
  $("addPhoneBtn").addEventListener("click", () => {
    $("phoneRows").insertAdjacentHTML("beforeend", phoneRowHTML(""));
    renumberPhones();
    $("phoneRows").lastElementChild.querySelector("input").focus();
  });
  $("phoneRows").addEventListener("click", e => {
    const rm = e.target.closest("[data-rm-phone]"); if (!rm) return;
    rm.closest(".media-row").remove(); renumberPhones();
  });
  function fillSettings() {
    const list = SC.phonesOf(settings);
    $("phoneRows").innerHTML = (list.length ? list : [""]).map(phoneRowHTML).join("");
    renumberPhones();
    $("setWa").value = settings.whatsapp || "";
    $("setAddress").value = settings.address || SC.DEFAULT_ADDRESS;
    $("setHero").value = settings.heroImage || "";
  }
  $("settingsForm").addEventListener("submit", async e => {
    e.preventDefault();
    const hero = $("setHero").value.trim();
    if (hero && !/^https?:\/\//i.test(hero)) { toast("Le lien de l'image doit commencer par http(s)://", true); return; }
    try {
      await SC.saveSettings({
        phones: [...document.querySelectorAll("#phoneRows .phone-in")].map(i => i.value.trim()).filter(Boolean),
        whatsapp: $("setWa").value.trim(),
        address: $("setAddress").value.trim() || SC.DEFAULT_ADDRESS,
        heroImage: hero
      });
      toast("Réglages enregistrés"); await refresh();
    } catch (err) { console.error(err); toast("Enregistrement impossible.", true); }
  });

  // ---------- car form ----------
  const modal = $("carModal"), form = $("carForm");

  function specRowHTML(s, i) {
    return `<div class="spec-row" data-label="${esc(s.label)}">
      <span class="spec-label">${esc(s.label)}</span>
      <input class="input spec-value" data-i="${i}" placeholder="${esc(s.ph)}">
    </div>`;
  }
  function customSpecHTML(label, value) {
    return `<div class="spec-row custom">
      <input class="input spec-label-input" placeholder="Nom (ex : Garantie)" value="${esc(label || "")}">
      <input class="input spec-value" placeholder="Valeur (ex : 2 ans)" value="${esc(value || "")}">
      <button type="button" class="x-btn" data-rm-spec aria-label="Retirer">&times;</button>
    </div>`;
  }
  function photoRowHTML(url) {
    return `<div class="media-row">
      <span class="media-n"></span>
      <input class="input photo-url" type="url" inputmode="url" placeholder="${PH_PHOTO}" value="${esc(url || "")}">
      <button type="button" class="x-btn" data-rm-photo aria-label="Retirer">&times;</button>
    </div>`;
  }
  function renumberPhotos() {
    form.querySelectorAll("#photoRows .media-n").forEach((el, i) => (el.textContent = i + 1));
  }

  function openCarForm(car) {
    editingId = car ? car.id : null;
    $("carModalTitle").textContent = car ? "Modifier la voiture" : "Ajouter une voiture";

    if (!sections.length) {
      form.innerHTML = `<div class="no-sections">
        <p>Crée d'abord une section (une marque, ex : Volkswagen, BMW…) avant d'ajouter une voiture.</p>
        <button type="button" class="btn btn-primary" id="goSections">Créer une section</button></div>`;
      $("goSections").addEventListener("click", () => { closeModal(); gotoTab("sections"); $("sectionName").focus(); });
      showModal(); return;
    }

    const c = car || {};
    const sel = c.sectionId || sections[0].id;
    const existing = (c.specs || []).slice();
    const taken = new Set();
    const suggestedValues = SUGGESTED_SPECS.map(s => {
      const idx = existing.findIndex(x => String(x.label).toLowerCase() === s.label.toLowerCase() && !taken.has(x));
      if (idx >= 0) { taken.add(existing[idx]); return existing[idx].value; }
      return "";
    });
    const customs = existing.filter(x => !taken.has(x));
    const photos = (c.photos && c.photos.length) ? c.photos : ["", "", "", ""];

    form.innerHTML = `
      <fieldset>
        <legend>Informations principales</legend>
        <div class="grid-2">
          <label class="field full">Section (marque) *
            <div class="section-select">
              <select class="select" id="fSectionSel">${sections.map(s => `<option value="${esc(s.id)}" ${s.id === sel ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
              <button type="button" class="btn btn-ghost" id="newSecBtn">+ Nouvelle</button>
            </div>
          </label>
          <label class="field">Modèle *
            <input class="input" id="fName" placeholder="Ex : Golf 8 GTI" value="${esc(c.name || "")}" required>
          </label>
          <label class="field">Année *
            <input class="input" id="fYearIn" type="number" inputmode="numeric" min="1950" max="2100" placeholder="Ex : 2024" value="${esc(c.year || "")}" required>
          </label>
          <label class="field">Prix (en millions)
            <input class="input" id="fPriceIn" type="number" inputmode="decimal" min="0" step="any" placeholder="Ex : 450 ou 1,5 — vide = « Prix sur demande »" value="${hasNum(c.price) ? esc(c.price) : ""}">
          </label>
          <label class="field">Kilométrage (km)
            <input class="input" id="fKmIn" type="number" inputmode="numeric" min="0" placeholder="Ex : 45000 (0 pour neuf)" value="${hasNum(c.mileage) ? esc(c.mileage) : ""}">
          </label>
          <label class="field">Carburant
            <select class="select" id="fFuelIn"><option value="">—</option>${FUELS.map(f => `<option ${f === c.fuel ? "selected" : ""}>${f}</option>`).join("")}</select>
          </label>
          <label class="field">Boîte de vitesses
            <select class="select" id="fGearIn"><option value="">—</option>${GEARBOXES.map(g => `<option ${g === c.transmission ? "selected" : ""}>${g}</option>`).join("")}</select>
          </label>
          <label class="field full">Couleur
            <input class="input" id="fColorIn" placeholder="Ex : Noir métallisé" value="${esc(c.color || "")}">
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Spécifications</legend>
        <p class="hint">Remplis seulement ce que tu veux afficher, les lignes vides sont ignorées. Ajoute les tiennes avec le bouton en bas.</p>
        <div id="specRows">${SUGGESTED_SPECS.map(specRowHTML).join("")}</div>
        <div id="customSpecs">${customs.map(x => customSpecHTML(x.label, x.value)).join("")}</div>
        <button type="button" class="btn btn-ghost btn-sm add-link" id="addSpecBtn">+ Ajouter une spécification</button>
      </fieldset>

      <fieldset>
        <legend>Photos et vidéo</legend>
        <p class="hint">Colle ici les liens de tes fichiers (Cloudinary, etc.). La photo n°1 sert de couverture.</p>
        <div id="photoRows">${photos.map(photoRowHTML).join("")}</div>
        <button type="button" class="btn btn-ghost btn-sm add-link" id="addPhotoBtn">+ Ajouter une photo</button>
        <label class="field" style="margin-top:22px">Vidéo (lien, facultatif)
          <input class="input" id="fVideoIn" type="url" inputmode="url" placeholder="${PH_VIDEO}" value="${esc(c.video || "")}">
        </label>
      </fieldset>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="cancelCar">Annuler</button>
        <button type="submit" class="btn btn-primary" id="saveCar">${car ? "Enregistrer les modifications" : "Ajouter la voiture"}</button>
      </div>`;

    // fill suggested values via DOM (avoids escaping issues in attributes)
    form.querySelectorAll("#specRows .spec-value").forEach((inp, i) => (inp.value = suggestedValues[i] || ""));
    renumberPhotos();
    showModal();
    form.scrollIntoView({ block: "start" });
  }

  // delegated events inside the form
  form.addEventListener("click", async e => {
    const t = e.target;
    if (t.id === "addSpecBtn") {
      $("customSpecs").insertAdjacentHTML("beforeend", customSpecHTML("", ""));
      $("customSpecs").lastElementChild.querySelector(".spec-label-input").focus();
    } else if (t.closest("[data-rm-spec]")) {
      t.closest(".spec-row").remove();
    } else if (t.id === "addPhotoBtn") {
      $("photoRows").insertAdjacentHTML("beforeend", photoRowHTML(""));
      renumberPhotos();
      $("photoRows").lastElementChild.querySelector("input").focus();
    } else if (t.closest("[data-rm-photo]")) {
      t.closest(".media-row").remove(); renumberPhotos();
    } else if (t.id === "cancelCar") {
      closeModal();
    } else if (t.id === "newSecBtn") {
      const name = (prompt("Nom de la nouvelle section (marque) :") || "").trim();
      if (!name) return;
      const dup = sections.find(s => s.name.toLowerCase() === name.toLowerCase());
      try {
        const id = dup ? dup.id : await SC.addSection(name);
        if (!dup) { ({ sections } = await SC.loadAll()); }
        $("fSectionSel").innerHTML = sections.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
        $("fSectionSel").value = id;
        renderSections();
        toast(dup ? "Cette section existait déjà, sélectionnée." : "Section ajoutée");
      } catch (err) { console.error(err); toast("Ajout de la section impossible.", true); }
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("fName").value.trim();
    const year = $("fYearIn").value.trim();
    if (!name) { toast("Le modèle est obligatoire.", true); $("fName").focus(); return; }
    if (!year || isNaN(Number(year))) { toast("L'année est obligatoire.", true); $("fYearIn").focus(); return; }

    const photos = [...form.querySelectorAll(".photo-url")].map(i => i.value.trim()).filter(Boolean);
    const video = $("fVideoIn").value.trim();
    const badUrl = photos.concat(video ? [video] : []).find(u => !/^https?:\/\//i.test(u));
    if (badUrl) { toast("Un lien photo/vidéo est invalide (il doit commencer par http:// ou https://).", true); return; }

    const specs = [];
    form.querySelectorAll("#specRows .spec-row").forEach(r => {
      const v = r.querySelector(".spec-value").value.trim();
      if (v) specs.push({ label: r.dataset.label, value: v });
    });
    form.querySelectorAll("#customSpecs .spec-row").forEach(r => {
      const l = r.querySelector(".spec-label-input").value.trim();
      const v = r.querySelector(".spec-value").value.trim();
      if (l && v) specs.push({ label: l, value: v });
    });

    const price = $("fPriceIn").value.trim(), km = $("fKmIn").value.trim();
    const prev = editingId ? cars.find(c => c.id === editingId) : null;
    const car = {
      id: editingId || undefined,
      sectionId: $("fSectionSel").value,
      name, year: Number(year),
      price: price !== "" ? Number(price) : null,
      mileage: km !== "" ? Number(km) : null,
      fuel: $("fFuelIn").value, transmission: $("fGearIn").value,
      color: $("fColorIn").value.trim(),
      specs, photos, video,
      createdAt: prev && prev.createdAt ? prev.createdAt : Date.now()
    };

    $("saveCar").disabled = true;
    try {
      await SC.saveCar(car);
      toast(editingId ? "Voiture modifiée" : "Voiture ajoutée");
      closeModal(); await refresh();
    } catch (err) {
      console.error(err);
      toast("Enregistrement impossible. Es-tu bien connecté ? Vérifie les règles Firestore.", true);
      $("saveCar").disabled = false;
    }
  });

  function showModal() { modal.hidden = false; document.body.style.overflow = "hidden"; modal.scrollTop = 0; }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; form.innerHTML = ""; editingId = null; }
  $("carModalClose").addEventListener("click", closeModal);
  modal.addEventListener("mousedown", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
})();
