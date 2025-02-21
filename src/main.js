import { auth } from "./js/fb.min";
import {} from "xlsx";
import { loadExcel } from "./js/excel.min";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import "./style.min.css";

document.addEventListener("DOMContentLoaded", function () {
  const loadingEl = document.getElementById("loading");
  const contentEl = document.getElementById("content");

  // Function to create and append login form
  function createLoginForm() {
    const loginForm = document.createElement("div");
    loginForm.id = "loginForm";
    loginForm.className = "container";
    loginForm.innerHTML = `
      <h2>Login</h2>
      <form id="login">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" required />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" required />
        </div>
        <button type="submit" class="btn">Login</button>
      </form>
    `;

    document.body.appendChild(loginForm);

    // Add event listener to the form
    document.getElementById("login").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      signInWithEmailAndPassword(auth, email, password).catch((error) => {
        alert("Error: " + error.message);
      });
    });

    return loginForm;
  }

  // Check authentication state
  onAuthStateChanged(auth, async (user) => {
    loadingEl.remove();
    let loginFormEl;

    if (user) {
      // Remove login form if it exists
      loginFormEl = document.getElementById("loginForm");
      if (loginFormEl) loginFormEl.remove();

      contentEl.style.display = "block";

      // Load excel.html content
      try {
        const response = await fetch("/pages/excel.html");
        const html = await response.text();
        contentEl.innerHTML = html;
        loadExcel();
      } catch (error) {
        console.error("Error loading content:", error);
        contentEl.innerHTML = "Error loading content";
      }
    } else {
      contentEl.style.display = "none";
      // Create login form if it doesn't exist
      loginFormEl = document.getElementById("loginForm");
      if (!loginFormEl) {
        loadingEl.remove();
        createLoginForm();
      }
    }
  });
});
