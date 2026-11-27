// ===================================================
// SIDAHMED CAR — data layer (shared by index.html and admin.html)
// Real mode : Firebase Firestore + Firebase Auth
// Demo mode : localStorage, used while firebase-config.js is not filled in
//
// Firestore layout
//   sections/{id}  { name, order }
//   cars/{id}      { sectionId, name, year, price, mileage, fuel, transmission,
//                    color, specs:[{label,value}], photos:[url], video, createdAt }
//   settings/site  { phone, whatsapp, address, heroImage }
// ===================================================
(function () {
  const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  const cfg = window.FIREBASE_CONFIG || {};
  const demoMode = !cfg.apiKey || /^YOUR_/.test(cfg.apiKey);

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = u => (/^https?:\/\//i.test(u || "") ? esc(u) : "");
  const uid = () => Math.random().toString(36).slice(2, 10);
  // Location used on the site (Google Maps embed) until the admin changes it
  const DEFAULT_ADDRESS = "VMVF+VP Tlemcen";
  // Phone numbers: settings.phones[] (older single settings.phone is still understood)
  const phonesOf = st => {
    const list = Array.isArray(st && st.phones) ? st.phones : (st && st.phone ? [st.phone] : []);
    return list.map(p => String(p || "").trim()).filter(Boolean);
  };
  // Prices are stored as a number of MILLIONS (e.g. 450 or 1.5) and displayed as typed
  const fmtPrice = p => {
    const n = Number(p);
    return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + (Math.abs(n) < 2 ? " million" : " millions");
  };

  let db, auth, F, A;

  // ---------- demo storage ----------
  const DEMO_KEY = "sidahmed_demo_v1";
  const R2 = "https://pub-527e4c33205944c28ce56503dfeaf3bf.r2.dev/";
  function demoSeed() {
    return {
      sections: [
        { id: "s-mercedes", name: "Mercedes", order: 1 },
        { id: "s-audi", name: "Audi", order: 2 },
        { id: "s-ford", name: "Ford", order: 3 }
      ],
      cars: [
        {
          id: "c1", sectionId: "s-mercedes", name: "C220d", year: 2025, price: null, mileage: null,
          fuel: "Diesel", transmission: "Automatique", color: "",
          specs: [
            { label: "Moteur", value: "4 cylindres en ligne turbodiesel de 1 993 cm³ (OM 654)" },
            { label: "Puissance", value: "197 ch (145 kW) à 3 600 tr/min" },
            { label: "Couple maximal", value: "440 Nm dès 1 800 tr/min" },
            { label: "Transmission", value: "Propulsion (RWD) ou intégrale (4MATIC), boîte 9G-TRONIC 9 rapports" },
            { label: "0 à 100 km/h", value: "7,3 secondes" },
            { label: "Vitesse maximale", value: "245 km/h" }
          ],
          photos: [R2 + "merc1.JPG", R2 + "merc2.JPG", R2 + "merc3.JPG", R2 + "merc4.JPG"],
          video: R2 + "merc%20video.MOV", createdAt: 3
        },
        {
          id: "c2", sectionId: "s-audi", name: "RS3", year: 2025, price: null, mileage: null,
          fuel: "Essence", transmission: "Automatique", color: "",
          specs: [
            { label: "Moteur", value: "5 cylindres en ligne turbo 2,5 L TFSI" },
            { label: "Puissance", value: "400 ch (294 kW)" },
            { label: "Couple maximal", value: "500 Nm" },
            { label: "Transmission", value: "Intégrale quattro, S tronic 7 rapports" },
            { label: "0 à 100 km/h", value: "3,8 secondes" },
            { label: "Vitesse maximale", value: "250 km/h (290 km/h avec packs dynamiques)" }
          ],
          photos: [R2 + "audi2.jpg", R2 + "audi3.jpg"], video: "", createdAt: 2
        },
        {
          id: "c3", sectionId: "s-ford", name: "Raptor R", year: 2025, price: null, mileage: null,
          fuel: "Essence", transmission: "Automatique", color: "",
          specs: [
            { label: "Moteur", value: "V8 5,2 L compresseur (\"Carnivore\")" },
            { label: "Puissance", value: "720 ch" },
            { label: "Couple maximal", value: "868 Nm à 4 250 tr/min" },
            { label: "Transmission", value: "4x4 permanent (4A / 4H / 4L / 2H), boîte auto 10 rapports" },
            { label: "0 à 60 mph (~96 km/h)", value: "3,6 secondes" }
          ],
          photos: [R2 + "raptor1.JPG", R2 + "raptor2.JPG"], video: R2 + "raptor%20video.MOV", createdAt: 1
        }
      ],
      settings: { phones: [], whatsapp: "", address: "", heroImage: "" }
    };
  }
  function demoLoad() {
    try {
      const d = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (d && d.sections && d.cars) return d;
    } catch (e) {}
    const s = demoSeed();
    demoSave(s);
    return s;
  }
  function demoSave(d) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch (e) {} }

  const sortSections = a => a.sort((x, y) => (x.order || 0) - (y.order || 0) || String(x.name).localeCompare(y.name));
  const sortCars = a => a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));

  // ---------- API ----------
  const SC = {
    demoMode, esc, safeUrl, fmtPrice, phonesOf, DEFAULT_ADDRESS,

    async init() {
      if (demoMode) return;
      const app = await import(FB + "firebase-app.js");
      F = await import(FB + "firebase-firestore.js");
      A = await import(FB + "firebase-auth.js");
      const a = app.initializeApp(cfg);
      db = F.getFirestore(a);
      auth = A.getAuth(a);
    },

    async loadAll() {
      if (demoMode) {
        const d = demoLoad();
        return { sections: sortSections(d.sections.slice()), cars: sortCars(d.cars.slice()), settings: d.settings || {} };
      }
      const [s, c, st] = await Promise.all([
        F.getDocs(F.collection(db, "sections")),
        F.getDocs(F.collection(db, "cars")),
        F.getDoc(F.doc(db, "settings", "site"))
      ]);
      return {
        sections: sortSections(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        cars: sortCars(c.docs.map(d => ({ id: d.id, ...d.data() }))),
        settings: st.exists() ? st.data() : {}
      };
    },

    async addSection(name) {
      const sec = { name, order: Date.now() };
      if (demoMode) { const d = demoLoad(); sec.id = "s-" + uid(); d.sections.push(sec); demoSave(d); return sec.id; }
      return (await F.addDoc(F.collection(db, "sections"), sec)).id;
    },
    async renameSection(id, name) {
      if (demoMode) { const d = demoLoad(); const s = d.sections.find(x => x.id === id); if (s) s.name = name; demoSave(d); return; }
      await F.updateDoc(F.doc(db, "sections", id), { name });
    },
    async deleteSection(id) {
      if (demoMode) { const d = demoLoad(); d.sections = d.sections.filter(x => x.id !== id); demoSave(d); return; }
      await F.deleteDoc(F.doc(db, "sections", id));
    },

    async saveCar(car) {
      const { id, ...data } = car;
      if (demoMode) {
        const d = demoLoad();
        if (id) { const i = d.cars.findIndex(x => x.id === id); if (i >= 0) d.cars[i] = { id, ...data }; }
        else d.cars.push({ id: "c-" + uid(), ...data });
        demoSave(d);
        return id;
      }
      if (id) { await F.setDoc(F.doc(db, "cars", id), data); return id; }
      return (await F.addDoc(F.collection(db, "cars"), data)).id;
    },
    async deleteCar(id) {
      if (demoMode) { const d = demoLoad(); d.cars = d.cars.filter(x => x.id !== id); demoSave(d); return; }
      await F.deleteDoc(F.doc(db, "cars", id));
    },

    async saveSettings(obj) {
      if (demoMode) { const d = demoLoad(); d.settings = obj; demoSave(d); return; }
      await F.setDoc(F.doc(db, "settings", "site"), obj);
    },

    // ---------- auth ----------
    onAuth(cb) {
      if (demoMode) { cb({ email: "mode démo" }); return; }
      A.onAuthStateChanged(auth, cb);
    },
    login(email, pw) { return A.signInWithEmailAndPassword(auth, email, pw); },
    logout() { return demoMode ? Promise.resolve() : A.signOut(auth); },

    resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} },

    // Cars that were saved in THIS browser while the site was still in demo mode
    // (before Firebase was configured). Sample cars (c1, c2, c3) are ignored.
    localDemoSummary() {
      if (demoMode) return null;
      let d;
      try { d = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { return null; }
      if (!d || !Array.isArray(d.cars)) return null;
      const sample = new Set(["c1", "c2", "c3"]);
      const list = d.cars.filter(c => !sample.has(c.id));
      return list.length ? { cars: list, sections: d.sections || [] } : null;
    },
    async importLocalDemo() {
      const s = SC.localDemoSummary();
      if (!s) return 0;
      const { sections: existing } = await SC.loadAll();
      const idMap = {};
      for (const oldId of [...new Set(s.cars.map(c => c.sectionId))]) {
        const sec = s.sections.find(x => x.id === oldId);
        const name = sec ? sec.name : "Autres";
        const dup = existing.find(x => String(x.name).toLowerCase() === name.toLowerCase());
        idMap[oldId] = dup ? dup.id : await SC.addSection(name);
      }
      let n = 0;
      for (const c of s.cars) {
        const { id, ...rest } = c;
        await SC.saveCar({ ...rest, sectionId: idMap[c.sectionId] });
        n++;
      }
      try { // keep a backup copy, and stop proposing the import
        localStorage.setItem(DEMO_KEY + "_imported", localStorage.getItem(DEMO_KEY));
        localStorage.removeItem(DEMO_KEY);
      } catch (e) {}
      return n;
    }
  };

  window.SC = SC;
})();
