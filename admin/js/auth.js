const form = document.getElementById("loginForm");
const status = document.getElementById("loginStatus");
if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = "Přihlašuji…";
    status.className = "form-status";
    try {
      await paulaAPI.login(document.getElementById("email").value.trim(), document.getElementById("password").value);
      location.assign("dashboard.html");
    } catch(error) {
      status.textContent = error.message;
      status.className = "form-status error";
    } finally { button.disabled = false; }
  });
}
