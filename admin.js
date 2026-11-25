// ===================================================
// SIDAHMED CAR — admin panel
// ===================================================
(async function () {
  const SC = window.SC;
  const { esc, safeUrl } = SC;
  const $ = id => document.getElementById(id);

  let sections = [], cars = [], settings = {};
  let editingId = null;

  // Specs suggested in the car form (the owner fills only what he wants)
  const SUGGESTED_SPECS = [
    { label: "Moteur", ph: "Ex : 4 cylindres turbodiesel 1 993 cm³" },
    { label: "Puissance", ph: "Ex : 197 ch (145 kW)" },
    { label: "Couple maximal", ph: "Ex : 440 Nm dès 1 800 tr/min" },
    { label: "Transmission", ph: "Ex : Propulsion / Traction / Intégrale 4x4" },
    { label: "0 à 100 km/h", ph: "Ex : 7,3 secondes" },
    { label: "Vitesse maximale", ph: "Ex : 245 km/h" },
    { label: "Consommation", ph: "Ex : 5,2 L/100 km" },
    { label: "Nombre de places", ph: "Ex : 5" },
    { label: "Nombre de portes", ph: "Ex : 4" },
    { label: "Options / équipements", ph: "Ex : Toit panoramique, caméra 360°, sièges chauffants…" }
  ];
  const FUELS = ["Essence", "Diesel", "Hybride", "Électrique", "GPL"];
  const GEARBOXES = ["Automatique", "Manuelle"];
  const PH_PHOTO = "https://res.cloudinary.com/votre-cloud/image/upload/photo.jpg";
  const PH_VIDEO = "https://res.cloudinary.com/votre-cloud/video/upload/video.mp4";

  // ---------- small helpers ----------
  let toastTimer;
  function toast(msg, isError) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
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
