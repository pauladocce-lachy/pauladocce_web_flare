(() => {
  "use strict";
  const KEY = "pauladocce_admin_session";
  const worker = String(window.PAULA_API_URL || "").replace(/\/$/, "");
  const isConfigured = /^https:\/\/[^\s/]+(?:\:[0-9]+)?$/.test(worker);

  function token() { return sessionStorage.getItem(KEY); }
  function logout() { sessionStorage.removeItem(KEY); location.assign("index.html"); }
  function requireConfig() {
    if (!isConfigured) throw new Error("Nejdříve nastavte adresu Cloudflare Workeru v admin/js/config.js.");
  }
  async function call(path, {method = "GET", data, auth = true} = {}) {
    requireConfig();
    const headers = {"Accept": "application/json"};
    if (data !== undefined) headers["Content-Type"] = "application/json";
    if (auth && token()) headers.Authorization = `Bearer ${token()}`;
    let response;
    try {
      response = await fetch(worker + path, {
        method, headers, cache: "no-store", body: data === undefined ? undefined : JSON.stringify(data)
      });
    } catch {
      throw new Error("Cloudflare Worker není dostupný. Ověřte jeho URL a povolenou doménu webu.");
    }
    let result;
    try { result = await response.json(); } catch { throw new Error(`Server vrátil neplatnou odpověď (${response.status}).`); }
    if (!response.ok) {
      if (response.status === 401 && path !== "/login") {
        sessionStorage.removeItem(KEY);
        location.replace("index.html");
      }
      const error = new Error(result.error || `Chyba serveru (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return result;
  }
  window.paulaAPI = {
    call, logout, token,
    login: async (email, password) => {
      const result = await call("/login", {method: "POST", auth: false, data: {email, password}});
      sessionStorage.setItem(KEY, result.token);
      return result;
    },
    session: () => call("/session"),
    pricing: () => call("/pricing"),
    savePricing: (data, sha) => call("/pricing", {method: "PUT", data: {data, sha}})
  };
})();
