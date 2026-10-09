/**
 * Datová konfigurace: Kompletní struktura hlavních kategorií a podkategorií
 */
const CATEGORIES_SCHEMA = {
  "Oblečení": [
    "šaty", "sukně", "trička", "topy", "halenky", "kalhoty", "kraťasy",
    "bundy", "kabáty", "spodní prádlo", "podprsenky", "kalhotky",
    "punčochy", "ponožky", "pyžama", "plavky", "kostýmy"
  ],
  "Obuv": [
    "Elegantní: lodičky", "Elegantní: jehlový podpatek", "Elegantní: široký podpatek",
    "Elegantní: platforma", "Elegantní: peep-toe", "Elegantní: slingback",
    "Elegantní: baleríny", "Mokasíny a polobotky", "Sandály: vysoký podpatek",
    "Sandály: nízký podpatek", "Sandály: platforma/klínek", "Sandály: páskové/gladiátorské",
    "Sandály: žabky/pantofle", "Kozačky: klasické", "Kozačky: pod kolena",
    "Kozačky: nad kolena", "Kozačky: do půli stehen", "Kozačky: šněrovací",
    "Kotníková obuv", "Extravagantní a vysoké platformy", "Tenisky a sneakers",
    "Sportovní a plátěné", "Domácí pantofle a bačkory", "Tematická obuv"
  ],
  "Paruky a vlasové doplňky": [
    "paruky", "příčesky", "ofiny", "culíky", "copy", "sponky", "čelenky", "gumičky", "vlasové ozdoby"
  ],
  "Nehty": [
    "umělé nehty na rukou", "umělé nehty na nohou", "celé sady nehtů", "jednotlivé nehty", "tipy", "kamínky a dekorace"
  ],
  "Šperky": [
    "náušnice", "náhrdelníky", "řetízky", "přívěsky", "prsteny", "náramky", "brože", "sady šperků"
  ],
  "Kosmetické a dekorativní doplňky": [
    "řasy", "náhradní řasy", "dekorativní líčení", "ozdoby kolem očí", "kamínky na obličej"
  ],
  "Pokrývky hlavy": [
    "klobouky", "čepice", "kšiltovky", "barety", "korunky a diadémy", "závoje", "masky"
  ],
  "Módní doplňky": [
    "kabelky", "psaníčka", "batůžky", "peněženky", "brýle", "rukavice", "šály", "mašle", "řetízky na tělo"
  ],
  "Ostatní příslušenství": [
    "tematické předměty", "miniatury", "dekorace", "fotografické rekvizity"
  ]
};

// IndexedDB inicializace
let db;
const DB_NAME = "SatnikPanenekDB";
const DB_VERSION = 1;

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("items")) {
        const itemStore = d.createObjectStore("items", { keyPath: "id" });
        itemStore.createIndex("category", "category", { unique: false });
        itemStore.createIndex("favorite", "favorite", { unique: false });
      }
      if (!d.objectStoreNames.contains("outfits")) {
        d.createObjectStore("outfits", { keyPath: "id" });
      }
      if (!d.objectStoreNames.contains("dolls")) {
        d.createObjectStore("dolls", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = (e) => reject(e);
  });
}

// Databázové operace
const DBService = {
  getAll: (storeName) => new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  }),
  get: (storeName, id) => new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
  }),
  put: (storeName, val) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(val);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  }),
  delete: (storeName, id) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  })
};

// Komprese a optimalizace fotografií do lokálního Base64 dataURL
function compressImage(file, maxDimension = 900, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (e) => reject(e);
      img.src = event.target.result;
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// Aplikační stav
let currentView = "view-home";
let currentPhotos = [];
let isListView = false;
let activeCategoryFilter = null;
let activeSubcategoryFilter = null;

// Inicializace UI
window.addEventListener("DOMContentLoaded", async () => {
  await initDB();
  setupNavigation();
  setupFormBindings();
  setupTheme();
  populateCategorySelects();
  await refreshAll();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }
});

function setupTheme() {
  const btn = document.getElementById("theme-btn");
  btn.onclick = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
  };
}

function setupNavigation() {
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.view;
      document.querySelectorAll(".view-content").forEach(v => v.classList.remove("active"));
      document.getElementById(target).classList.add("active");
      
      const titles = {
        "view-home": "Domů",
        "view-catalog": "Katalog",
        "view-outfits": "Outfity",
        "view-dolls": "Panenky",
        "view-settings": "Záloha & Data"
      };
      document.getElementById("view-title").textContent = titles[target] || "Šatník";
      currentView = target;
      if (target === "view-catalog") renderCatalog();
      if (target === "view-outfits") renderOutfits();
      if (target === "view-dolls") renderDolls();
    };
  });

  document.getElementById("fab-add").onclick = () => openItemModal();
  document.getElementById("view-toggle-btn").onclick = () => {
    isListView = !isListView;
    document.getElementById("view-toggle-btn").textContent = isListView ? "🔲" : "📋";
    renderCatalog();
  };
}

function populateCategorySelects() {
  const catSel = document.getElementById("item-category");
  catSel.innerHTML = "";
  Object.keys(CATEGORIES_SCHEMA).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSel.appendChild(opt);
  });

  catSel.onchange = () => updateSubcategorySelect(catSel.value);
  updateSubcategorySelect(catSel.value);
}

function updateSubcategorySelect(cat) {
  const subSel = document.getElementById("item-subcategory");
  subSel.innerHTML = "";
  const list = CATEGORIES_SCHEMA[cat] || [];
  list.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    subSel.appendChild(opt);
  });

  // Zobrazit/skrýt specifická pole
  document.getElementById("fields-shoes").style.display = cat === "Obuv" ? "block" : "none";
  document.getElementById("fields-wigs").style.display = cat === "Paruky a vlasové doplňky" ? "block" : "none";
  document.getElementById("fields-nails").style.display = cat === "Nehty" ? "block" : "none";
}

function setupFormBindings() {
  const cameraInput = document.getElementById("file-camera");
  const galleryInput = document.getElementById("file-gallery");

  document.getElementById("btn-camera").onclick = () => cameraInput.click();
  document.getElementById("btn-gallery").onclick = () => galleryInput.click();

  const handleFiles = async (files) => {
    for (const f of Array.from(files)) {
      const b64 = await compressImage(f);
      currentPhotos.push(b64);
    }
    renderPhotoPreviews();
  };

  cameraInput.onchange = (e) => handleFiles(e.target.files);
  galleryInput.onchange = (e) => handleFiles(e.target.files);

  document.getElementById("form-item").onsubmit = async (e) => {
    e.preventDefault();
    if (currentPhotos.length === 0) {
      alert("Přidejte prosím alespoň jednu fotografii předmětu.");
      return;
    }

    const id = document.getElementById("item-id").value || "item_" + Date.now();
    const item = {
      id,
      name: document.getElementById("item-name").value.trim(),
      category: document.getElementById("item-category").value,
      subcategory: document.getElementById("item-subcategory").value,
      photos: currentPhotos,
      quantity: parseInt(document.getElementById("item-quantity").value) || 1,
      condition: document.getElementById("item-condition").value,
      location: document.getElementById("item-location").value.trim(),
      tags: document.getElementById("item-tags").value.split(",").map(s => s.trim()).filter(Boolean),
      notes: document.getElementById("item-notes").value.trim(),
      favorite: document.getElementById("item-favorite").checked,
      updatedAt: Date.now(),
      specs: {
        heel: document.getElementById("shoe-heel").value,
        platform: document.getElementById("shoe-platform").value,
        fastening: document.getElementById("shoe-fastening").value.trim(),
        wigLength: document.getElementById("wig-length").value.trim(),
        wigStyle: document.getElementById("wig-style").value.trim(),
        nailTarget: document.getElementById("nail-target").value,
        nailShape: document.getElementById("nail-shape").value.trim()
      }
    };

    await DBService.put("items", item);
    closeModals();
    await refreshAll();
  };

  document.getElementById("modal-item-cancel").onclick = closeModals;
  document.getElementById("detail-close-btn").onclick = closeModals;
  document.getElementById("modal-outfit-cancel").onclick = closeModals;

  document.getElementById("modal-item-delete").onclick = async () => {
    const id = document.getElementById("item-id").value;
    if (confirm("Opravdu chcete tento předmět nenávratně smazat z inventáře?")) {
      await DBService.delete("items", id);
      closeModals();
      await refreshAll();
    }
  };

  document.getElementById("catalog-search").oninput = () => renderCatalog();
  document.getElementById("export-btn").onclick = exportFullDatabase;
  document.getElementById("import-file").onchange = importDatabaseFile;
  document.getElementById("new-outfit-btn").onclick = () => openOutfitModal();
  document.getElementById("form-outfit").onsubmit = saveOutfit;
}

function renderPhotoPreviews() {
  const cont = document.getElementById("item-photos-container");
  cont.innerHTML = "";
  currentPhotos.forEach((src, idx) => {
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.style.display = "inline-block";

    const img = document.createElement("img");
    img.src = src;
    img.className = "photo-slot" + (idx === 0 ? " active" : "");
    img.title = idx === 0 ? "Hlavní fotka" : "Kliknutím nastavíte jako hlavní";
    img.onclick = () => {
      const chosen = currentPhotos.splice(idx, 1)[0];
      currentPhotos.unshift(chosen);
      renderPhotoPreviews();
    };

    const del = document.createElement("button");
    del.innerHTML = "×";
    del.style.position = "absolute";
    del.style.top = "2px";
    del.style.right = "2px";
    del.style.background = "rgba(0,0,0,0.7)";
    del.style.color = "white";
    del.style.border = "none";
    del.style.borderRadius = "50%";
    del.style.width = "18px";
    del.style.height = "18px";
    del.style.fontSize = "12px";
    del.style.cursor = "pointer";
    del.onclick = (e) => {
      e.stopPropagation();
      currentPhotos.splice(idx, 1);
      renderPhotoPreviews();
    };

    wrap.appendChild(img);
    wrap.appendChild(del);
    cont.appendChild(wrap);
  });
}

function openItemModal(item = null) {
  currentPhotos = [];
  document.getElementById("item-id").value = item ? item.id : "";
  document.getElementById("modal-item-title").textContent = item ? "Upravit předmět" : "Přidat nový předmět";
  document.getElementById("modal-item-delete").style.display = item ? "block" : "none";

  if (item) {
    document.getElementById("item-name").value = item.name;
    document.getElementById("item-category").value = item.category;
    updateSubcategorySelect(item.category);
    document.getElementById("item-subcategory").value = item.subcategory;
    document.getElementById("item-quantity").value = item.quantity;
    document.getElementById("item-condition").value = item.condition;
    document.getElementById("item-location").value = item.location || "";
    document.getElementById("item-tags").value = (item.tags || []).join(", ");
    document.getElementById("item-notes").value = item.notes || "";
    document.getElementById("item-favorite").checked = !!item.favorite;
    currentPhotos = [...(item.photos || [])];

    if (item.specs) {
      document.getElementById("shoe-heel").value = item.specs.heel || "";
      document.getElementById("shoe-platform").value = item.specs.platform || "ne";
      document.getElementById("shoe-fastening").value = item.specs.fastening || "";
      document.getElementById("wig-length").value = item.specs.wigLength || "";
      document.getElementById("wig-style").value = item.specs.wigStyle || "";
      document.getElementById("nail-target").value = item.specs.nailTarget || "ruce";
      document.getElementById("nail-shape").value = item.specs.nailShape || "";
    }
  } else {
    document.getElementById("form-item").reset();
    document.getElementById("item-id").value = "";
    updateSubcategorySelect(document.getElementById("item-category").value);
  }

  renderPhotoPreviews();
  document.getElementById("modal-item").classList.add("active");
}

function closeModals() {
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
}

async function refreshAll() {
  const items = await DBService.getAll("items");
  updateHomeStats(items);
  renderHomeCategories(items);
  renderRecentItems(items);
  if (currentView === "view-catalog") renderCatalog();
}

function updateHomeStats(items) {
  document.getElementById("stat-total").textContent = items.length;
  document.getElementById("stat-fav").textContent = items.filter(i => i.favorite).length;
  document.getElementById("stat-damaged").textContent = items.filter(i => ["Poškozený", "K opravě"].includes(i.condition)).length;
}

function renderHomeCategories(items) {
  const grid = document.getElementById("home-categories-grid");
  grid.innerHTML = "";
  Object.keys(CATEGORIES_SCHEMA).forEach(cat => {
    const catItems = items.filter(i => i.category === cat);
    const count = catItems.length;
    const thumb = catItems.length > 0 && catItems[0].photos.length > 0
      ? catItems[0].photos[0]
      : "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23222' width='100' height='100'/><text fill='%23666' x='50%' y='55%' text-anchor='middle'>Bez foto</text></svg>";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img class="card-img" src="${thumb}" alt="${cat}">
      <div class="card-body">
        <div class="card-title">${cat}</div>
        <div class="card-meta">${count} položek</div>
      </div>
    `;
    card.onclick = () => {
      activeCategoryFilter = cat;
      activeSubcategoryFilter = null;
      document.querySelector('[data-view="view-catalog"]').click();
    };
    grid.appendChild(card);
  });
}

function renderRecentItems(items) {
  const grid = document.getElementById("home-recent-grid");
  grid.innerHTML = "";
  const recent = [...items].sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
  recent.forEach(item => {
    grid.appendChild(createItemCard(item));
  });
}

function createItemCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  const mainPhoto = item.photos && item.photos.length > 0 ? item.photos[0] : "";
  const isDamaged = ["Poškozený", "K opravě"].includes(item.condition);

  card.innerHTML = `
    <img class="card-img" src="${mainPhoto}" alt="${item.name}">
    <div class="card-body">
      <div>
        <div class="card-title">${item.name}</div>
        <div class="card-meta">${item.subcategory}</div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
        <span class="badge ${isDamaged ? 'danger' : ''}">${item.condition}</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">${item.quantity} ks</span>
      </div>
    </div>
  `;
  card.onclick = () => openDetailModal(item);
  return card;
}

async function renderCatalog() {
  const grid = document.getElementById("catalog-grid");
  grid.className = isListView ? "list-view" : "grid";
  grid.innerHTML = "";

  const query = document.getElementById("catalog-search").value.toLowerCase().trim();
  let items = await DBService.getAll("items");

  const nav = document.getElementById("catalog-nav");
  if (activeCategoryFilter) {
    nav.innerHTML = `Kategorie: <b>${activeCategoryFilter}</b> ${activeSubcategoryFilter ? `› ${activeSubcategoryFilter}` : ''} <a href="#" id="reset-cat" style="color:var(--text-muted); margin-left:8px;">[Zrušit filtr]</a>`;
    document.getElementById("reset-cat").onclick = (e) => {
      e.preventDefault();
      activeCategoryFilter = null;
      activeSubcategoryFilter = null;
      renderCatalog();
    };
  } else {
    nav.innerHTML = "Zobrazeny všechny položky";
  }

  items = items.filter(item => {
    if (activeCategoryFilter && item.category !== activeCategoryFilter) return false;
    if (activeSubcategoryFilter && item.subcategory !== activeSubcategoryFilter) return false;
    if (query) {
      const matchName = item.name.toLowerCase().includes(query);
      const matchNotes = (item.notes || "").toLowerCase().includes(query);
      const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(query));
      return matchName || matchNotes || matchTags;
    }
    return true;
  });

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">Žádné položky k zobrazení.</div>`;
    return;
  }

  items.forEach(item => {
    grid.appendChild(createItemCard(item));
  });
}

function openDetailModal(item) {
  document.getElementById("detail-name").textContent = item.name;
  document.getElementById("detail-category-path").textContent = `${item.category} › ${item.subcategory}`;
  document.getElementById("detail-fav-badge").textContent = item.favorite ? "⭐" : "";

  const mainImg = document.getElementById("detail-main-img");
  mainImg.src = item.photos[0] || "";

  const thumbs = document.getElementById("detail-thumbnails");
  thumbs.innerHTML = "";
  item.photos.forEach(src => {
    const t = document.createElement("img");
    t.src = src;
    t.className = "photo-slot" + (src === mainImg.src ? " active" : "");
    t.onclick = () => {
      mainImg.src = src;
      thumbs.querySelectorAll("img").forEach(el => el.classList.remove("active"));
      t.classList.add("active");
    };
    thumbs.appendChild(t);
  });

  let specsHTML = `
    <div><b>Stav:</b> ${item.condition} | <b>Kusů:</b> ${item.quantity}</div>
    <div><b>Umístění:</b> ${item.location || "Neuvedeno"}</div>
  `;
  if (item.notes) specsHTML += `<div style="margin-top:6px;"><b>Poznámka:</b> ${item.notes}</div>`;
  if (item.tags && item.tags.length > 0) specsHTML += `<div style="margin-top:4px;"><b>Štítky:</b> ${item.tags.join(", ")}</div>`;

  if (item.specs) {
    if (item.category === "Obuv") {
      specsHTML += `<div style="margin-top:6px; color:var(--accent);"><b>Podpatek:</b> ${item.specs.heel || "-"} | <b>Platforma:</b> ${item.specs.platform} | <b>Zapínání:</b> ${item.specs.fastening || "-"}</div>`;
    } else if (item.category === "Paruky a vlasové doplňky") {
      specsHTML += `<div style="margin-top:6px; color:var(--accent);"><b>Délka:</b> ${item.specs.wigLength || "-"} | <b>Styl:</b> ${item.specs.wigStyle || "-"}</div>`;
    } else if (item.category === "Nehty") {
      specsHTML += `<div style="margin-top:6px; color:var(--accent);"><b>Určení:</b> ${item.specs.nailTarget} | <b>Tvar/Délka:</b> ${item.specs.nailShape || "-"}</div>`;
    }
  }

  document.getElementById("detail-specs").innerHTML = specsHTML;

  document.getElementById("detail-edit-btn").onclick = () => {
    closeModals();
    openItemModal(item);
  };

  document.getElementById("modal-detail").classList.add("active");
}

let currentOutfitPhoto = "";

async function openOutfitModal(outfit = null) {
  const items = await DBService.getAll("items");
  const allOutfits = await DBService.getAll("outfits");

  document.getElementById("outfit-id").value = outfit ? outfit.id : "";
  document.getElementById("modal-outfit-title").textContent = outfit ? "Upravit outfit" : "Nový outfit";
  document.getElementById("outfit-name").value = outfit ? outfit.name : "";
  document.getElementById("outfit-notes").value = outfit ? (outfit.notes || "") : "";
  currentOutfitPhoto = outfit ? (outfit.photo || "") : "";

  const preview = document.getElementById("outfit-photo-preview");
  preview.innerHTML = currentOutfitPhoto ? `<img src="${currentOutfitPhoto}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="color:var(--text-muted); font-size:0.8rem;">Žádná fotografie</span>`;

  document.getElementById("outfit-photo-file").onchange = async (e) => {
    if (e.target.files[0]) {
      currentOutfitPhoto = await compressImage(e.target.files[0]);
      preview.innerHTML = `<img src="${currentOutfitPhoto}" style="width:100%; height:100%; object-fit:cover;">`;
    }
  };

  const container = document.getElementById("outfit-items-selector");
  container.innerHTML = "";
  const selectedSet = new Set(outfit ? outfit.itemIds : []);

  items.forEach(it => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.marginBottom = "6px";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.value = it.id;
    chk.checked = selectedSet.has(it.id);
    chk.onchange = () => checkOutfitConflicts(items, allOutfits);

    const lbl = document.createElement("label");
    lbl.textContent = `[${it.category}] ${it.name} (${it.quantity} ks)`;
    lbl.style.fontSize = "0.8rem";

    row.appendChild(chk);
    row.appendChild(lbl);
    container.appendChild(row);
  });

  checkOutfitConflicts(items, allOutfits);
  document.getElementById("modal-outfit").classList.add("active");
}

function checkOutfitConflicts(items, allOutfits) {
  const checkedIds = Array.from(document.querySelectorAll("#outfit-items-selector input:checked")).map(el => el.value);
  const currentOutfitId = document.getElementById("outfit-id").value;
  const warnings = [];

  checkedIds.forEach(id => {
    const item = items.find(i => i.id === id);
    if (item && item.quantity === 1) {
      const conflicting = allOutfits.filter(o => o.id !== currentOutfitId && (o.itemIds || []).includes(id));
      if (conflicting.length > 0) {
        warnings.push(`Předmět "${item.name}" je k dispozici pouze v 1 kuse a je již použit v outfitu: ${conflicting.map(c => c.name).join(", ")}.`);
      }
    }
  });

  const warnContainer = document.getElementById("outfit-conflicts-container");
  if (warnings.length > 0) {
    warnContainer.innerHTML = warnings.map(w => `<div class="conflict-warning">⚠️ ${w}</div>`).join("");
  } else {
    warnContainer.innerHTML = "";
  }
}

async function saveOutfit(e) {
  e.preventDefault();
  const id = document.getElementById("outfit-id").value || "outfit_" + Date.now();
  const itemIds = Array.from(document.querySelectorAll("#outfit-items-selector input:checked")).map(el => el.value);

  const outfit = {
    id,
    name: document.getElementById("outfit-name").value.trim(),
    photo: currentOutfitPhoto,
    itemIds,
    notes: document.getElementById("outfit-notes").value.trim(),
    updatedAt: Date.now()
  };

  await DBService.put("outfits", outfit);
  closeModals();
  renderOutfits();
}

async function renderOutfits() {
  const grid = document.getElementById("outfits-grid");
  grid.innerHTML = "";
  const outfits = await DBService.getAll("outfits");

  if (outfits.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Zatím žádné vytvořené outfity.</div>`;
    return;
  }

  outfits.forEach(o => {
    const card = document.createElement("div");
    card.className = "card";
    const img = o.photo || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23222' width='100' height='100'/><text fill='%23666' x='50%' y='55%' text-anchor='middle'>Bez foto</text></svg>";
    card.innerHTML = `
      <img class="card-img" src="${img}" alt="${o.name}">
      <div class="card-body">
        <div class="card-title">${o.name}</div>
        <div class="card-meta">${(o.itemIds || []).length} použitých věcí</div>
      </div>
    `;
    card.onclick = () => openOutfitModal(o);
    grid.appendChild(card);
  });
}

async function renderDolls() {
  const grid = document.getElementById("dolls-grid");
  grid.innerHTML = "";
  const dolls = await DBService.getAll("dolls");

  if (dolls.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Zatím nejsou zaevidovány žádné panenky. Můžete přidat první a přiřadit jí outfit.</div>`;
    return;
  }

  dolls.forEach(d => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-body">
        <div class="card-title">${d.name}</div>
        <div class="card-meta">Aktivní outfit: ${d.currentOutfitName || "Žádný"}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById("new-doll-btn").onclick = async () => {
  const name = prompt("Zadejte jméno panenky:");
  if (name && name.trim()) {
    const doll = {
      id: "doll_" + Date.now(),
      name: name.trim(),
      currentOutfitId: null,
      outfitHistory: []
    };
    await DBService.put("dolls", doll);
    renderDolls();
  }
};

async function exportFullDatabase() {
  const items = await DBService.getAll("items");
  const outfits = await DBService.getAll("outfits");
  const dolls = await DBService.getAll("dolls");

  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    outfits,
    dolls
  };

  const blob = new Blob([JSON.stringify(backupData)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `satnik_panenek_zaloha_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importDatabaseFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.items || !Array.isArray(data.items)) {
        alert("Chyba integrity: Neplatný formát záložního souboru.");
        return;
      }

      if (confirm(`Záloha obsahuje ${data.items.length} předmětů a ${data.outfits?.length || 0} outfitů. Přejete si obnovit tato data?`)) {
        for (const it of data.items) await DBService.put("items", it);
        if (data.outfits) {
          for (const out of data.outfits) await DBService.put("outfits", out);
        }
        if (data.dolls) {
          for (const d of data.dolls) await DBService.put("dolls", d);
        }
        alert("Data byla úspěšně obnovena.");
        await refreshAll();
      }
    } catch (err) {
      alert("Došlo k chybě při načítání souboru: " + err.message);
    }
  };
  reader.readAsText(file);
}
