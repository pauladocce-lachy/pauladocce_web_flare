(() => {
  "use strict";
  const container = document.getElementById("pricingContainer");
  if (!container) return;
  const status = document.getElementById("editorStatus");
  const save = document.getElementById("saveAllBtn");
  let data = null;
  let sha = null;
  let changed = false;
  const categories = [
    {id: "damske", name: "Dámské"},
    {id: "panske", name: "Pánské"},
    {id: "detske", name: "Dětské"}
  ];
  const fields = ["name", "shortHair", "mediumHair", "longHair"];
  function message(text, state = "") {
    status.textContent = text;
    status.className = "form-status " + state;
  }
  function el(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }
  function createButton(label, cls, callback, title) {
    const button = el("button", cls, label);
    button.type = "button";
    if (title) button.title = title;
    button.addEventListener("click", callback);
    return button;
  }
  function markDirty() {
    changed = true;
    message("Máte neuložené změny.", "warning");
  }
  function render() {
    container.replaceChildren();
    for (const cat of data.categories) {
      const card = el("section", "category-card");
      card.append(el("h2", "", cat.name));
      const head = el("div", "service-row service-header");
      for (const name of ["Služba", "Krátké", "Střední", "Dlouhé", "Akce"])
        head.append(el("div", "", name));
      card.append(head);
      for (const service of cat.services) {
        const row = el("div", "service-row");
        for (const field of fields) {
          const input = el("input", "service-" + field);
          input.type = "text";
          input.placeholder = ({name:"Název služby", shortHair:"Krátké vlasy", mediumHair:"Střední vlasy", longHair:"Dlouhé vlasy"})[field];
          input.value = service[field] || "";
          input.maxLength = field === "name" ? 120 : 60;
          input.setAttribute("aria-label", `${cat.name}: ${field} – ${service.name}`);
          input.addEventListener("input", () => { service[field] = input.value; markDirty(); });
          row.append(input);
        }
        const actions = el("div", "row-actions");
        actions.append(
          createButton("↑", "move-btn", () => move(cat, service, -1), "Posunout výš"),
          createButton("↓", "move-btn", () => move(cat, service, 1), "Posunout níž"),
          createButton("✕", "delete-btn", () => {
            if (!confirm(`Opravdu chcete odstranit službu „${service.name}“?`)) return;
            cat.services = cat.services.filter(item => item.id !== service.id);
            markDirty(); render();
          }, "Odstranit službu")
        );
        row.append(actions);
        card.append(row);
      }
      const add = el("div", "add-service");
      add.append(createButton("+ Přidat službu", "add-service-btn", () => {
        cat.services.push({id: crypto.randomUUID(), name: "Nová služba", shortHair: "", mediumHair: "", longHair: ""});
        markDirty(); render();
      }));
      card.append(add);
      container.append(card);
    }
  }
  function move(cat, service, direction) {
    const index = cat.services.indexOf(service);
    const next = index + direction;
    if (next < 0 || next >= cat.services.length) return;
    [cat.services[index],cat.services[next]] = [cat.services[next],cat.services[index]];
    markDirty(); render();
  }
  function validate() {
    for (const cat of data.categories) {
      const names = new Set();
      for (const service of cat.services) {
        service.name = service.name.trim();
        for (const key of fields.slice(1)) service[key] = service[key].trim();
        if (!service.name) throw new Error(`V kategorii ${cat.name} je služba bez názvu.`);
        if (names.has(service.name.toLowerCase())) throw new Error(`Duplicitní název „${service.name}“ v kategorii ${cat.name}.`);
        names.add(service.name.toLowerCase());
      }
    }
  }
  async function load() {
    message("Načítám aktuální ceník z GitHubu…");
    try {
      await paulaAPI.session();
      const result = await paulaAPI.pricing();
      data = result.data;
      sha = result.sha;
      changed = false;
      render();
      message("Ceník načten. Úpravy se odešlou až po kliknutí na Uložit.", "success");
    } catch(error) { message(error.message,"error"); container.replaceChildren(); save.disabled = true; }
  }
  save.addEventListener("click", async () => {
    if (!data) return;
    try { validate(); } catch(error) { message(error.message, "error"); return; }
    save.disabled = true;
    message("Ukládám změny do GitHubu…");
    try {
      const result = await paulaAPI.savePricing(data, sha);
      sha = result.sha;
      changed = false;
      render();
      message("✓ Uloženo do GitHubu. Veřejný web se aktualizuje po nasazení GitHub Pages.", "success");
    } catch(error) {
      if (error.status === 409) message("Ceník mezitím změnil někdo jiný. Zkopírujte si své úpravy a obnovte stránku; změny nebyly přepsány.", "error");
      else message(error.message,"error");
    } finally { save.disabled = false; }
  });
  document.getElementById("logoutBtn")?.addEventListener("click",event => { event.preventDefault(); if (changed && !confirm("Zahodit neuložené změny?")) return; paulaAPI.logout(); });
  window.addEventListener("beforeunload", event => { if (!changed) return; event.preventDefault(); event.returnValue = ""; });
  load();
})();
