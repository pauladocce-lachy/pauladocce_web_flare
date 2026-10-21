document.addEventListener("DOMContentLoaded", async () => {
  try {
    const categories = await PaulaPricing.load();
    for (const category of categories) {
      const container = document.querySelector(`#pricing-${category.id} .pricing-table-container`);
      if (!container) continue;
      container.replaceChildren();
      const table = document.createElement("table"); table.className = "pricing-table";
      const head = document.createElement("thead");
      const headings = document.createElement("tr");
      for (const text of ["Služba", "Krátké", "Střední", "Dlouhé"]) {
        const th = document.createElement("th"); th.textContent = text; headings.append(th);
      }
      head.append(headings); table.append(head);
      const body = document.createElement("tbody");
      for (const service of category.services || []) {
        const row = document.createElement("tr");
        for (const value of [service.name, ...[service.shortHair,service.mediumHair,service.longHair].map(PaulaPricing.price)]) {
          const td = document.createElement("td"); td.textContent = value || ""; row.append(td);
        }
        body.append(row);
      }
      table.append(body); container.append(table);
    }
  } catch (error) {
    document.querySelectorAll(".pricing-table-container").forEach(item => { item.textContent = "Ceník se momentálně nepodařilo načíst."; });
    console.error(error);
  }
});
