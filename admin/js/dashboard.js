document.addEventListener("DOMContentLoaded", async () => {
  const logout = document.getElementById("logoutBtn");
  logout?.addEventListener("click", event => { event.preventDefault(); paulaAPI.logout(); });
  try { await paulaAPI.session(); }
  catch (error) {
    if (error.status !== 401) {
      const status = document.querySelector(".status-card");
      status.textContent = error.message;
      status.classList.add("error");
    }
  }
});
