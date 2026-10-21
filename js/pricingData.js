// Na veřejném webu se ceník načítá přímo ze souboru data/pricing.json.
window.PaulaPricing = {
  async load() {
    const response = await fetch(new URL("data/pricing.json", document.baseURI), {cache: "no-store"});
    if (!response.ok) throw new Error("Ceník se nepodařilo načíst.");
    const data = await response.json();
    if (!Array.isArray(data.categories)) throw new Error("Ceník má neplatný formát.");
    return data.categories;
  },
  price(value) { return String(value || "").trim() || "–"; }
};
