document.addEventListener("DOMContentLoaded", async () => {
  const preview = document.querySelector(".pricing-preview");
  if (!preview) return;
  try {
    const categories = await PaulaPricing.load();
    const services = categories.flatMap(cat => cat.services || []).slice(0, 4);
    preview.replaceChildren();
    if (!services.length) { preview.textContent = "Ceník připravujeme."; return; }
    for (const service of services) {
      const row = document.createElement("div"); row.className = "price-row";
      const name = document.createElement("span"); name.textContent = service.name;
      const price = document.createElement("span");
      price.textContent = PaulaPricing.price(service.shortHair || service.mediumHair || service.longHair);
      row.append(name, price); preview.append(row);
    }
  } catch(error) { preview.textContent = "Ceník se momentálně nepodařilo načíst."; console.error(error); }
});
