import { auth } from "./js/fb.min";
import { TABS_ENABLED, TABS, DEFAULT_TAB } from "./js/config.min.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import "./style.min.css";
import "./css/excel.min.css";

let userRole = null; // Variable to store the user's role

document.addEventListener("DOMContentLoaded", function () {
  const loadingEl = document.getElementById("loading");
  const contentEl = document.getElementById("content");

  onAuthStateChanged(auth, async (user) => {
    let loginFormEl;

    if (loadingEl) {
      loadingEl.remove();
    }

    if (user) {
      try {
        const idTokenResult = await user.getIdTokenResult();
        const claims = idTokenResult.claims;
        if (claims && (claims.role === "admin" || claims.role === "upload")) {
          userRole = claims.role;
          console.log("User role:", userRole); // Optional: for debugging
        } else {
          userRole = "user"; // Default role if no specific admin/upload role is found
        }
      } catch (error) {
        console.error("Error getting user claims:", error);
        userRole = "user"; // Default to 'user' on error
      }

      const { loadInventory, loadCatalog, loadUpload } = await import(
        "./js/excel.min.js"
      );
      loginFormEl = document.getElementById("loginForm");

      if (loginFormEl) {
        loginFormEl.remove();
      }

      contentEl.style.display = "block";

      try {
        const response = await fetch("/pages/excel.html");
        const html = await response.text();
        contentEl.innerHTML = html;
        // Get elements
        const rfcElement = document.getElementById("rfc");
        const immexElement = document.getElementById("immex");
        const addrElement = document.getElementById("financialAddr");

        // Set content with null checks
        if (rfcElement && import.meta.env.VITE_RFC) {
          rfcElement.textContent = import.meta.env.VITE_RFC;
        }

        if (immexElement && import.meta.env.VITE_IMMEX) {
          immexElement.textContent = import.meta.env.VITE_IMMEX;
        }

        if (addrElement && import.meta.env.VITE_FINANCIAL_ADDR) {
          const addrValue = import.meta.env.VITE_FINANCIAL_ADDR.replace(
            /^'|'$/g,
            ""
          );
          addrElement.textContent = addrValue;
        }
        // Load Excel file by default
        loadInventory();

        // Setup tab navigation only if it's enabled
        if (TABS_ENABLED) {
          const container = document.querySelector("#tableContainer");
          const tabButtonsContainer = document.getElementById("tabButtons");

          // Function to create a tab button
          function createTabButton(tabId, tabConfig) {
            // Modified to accept tabConfig
            const button = document.createElement("button");
            button.id = tabId;
            button.className = "tab-btn";
            button.textContent = tabConfig.label; // Use tabConfig.label
            button.dataset.tab = tabId;
            return button;
          }

          // Add tab buttons based on the config
          for (const tabId in TABS) {
            if (TABS[tabId].enabled) {
              // Check if tab is generally enabled
              if (tabId === "upload") {
                // Special handling for upload tab
                if (userRole === "admin" || userRole === "upload") {
                  const button = createTabButton(tabId, TABS[tabId]);
                  tabButtonsContainer.appendChild(button);
                }
              } else {
                const button = createTabButton(tabId, TABS[tabId]);
                tabButtonsContainer.appendChild(button);
              }
            }
          }

          // Set active tab based on DEFAULT_TAB
          const defaultTabButton = document.getElementById(DEFAULT_TAB);
          if (defaultTabButton) {
            defaultTabButton.classList.add("active");

            // Apply initial CSS classes for default tab
            const defaultConfig = TABS[DEFAULT_TAB];
            if (defaultConfig.cssClass) {
              container.classList.add(defaultConfig.cssClass);
            }
          }

          tabButtonsContainer.addEventListener("click", async (event) => {
            const target = event.target;
            if (!target.classList.contains("tab-btn")) return;

            const clickedTabId = target.id;
            const tabConfig = TABS[clickedTabId];

            if (!tabConfig) {
              console.warn(`No configuration found for tab: ${clickedTabId}`);
              return;
            }

            // Remove active class from all tabs
            document.querySelectorAll(".tab-btn").forEach((btn) => {
              btn.classList.remove("active");
            });

            // Add active class to clicked tab
            target.classList.add("active");

            // Apply CSS classes
            // First remove all possible tab classes to avoid conflicts
            for (const id in TABS) {
              if (TABS[id].cssClass) {
                container.classList.remove(TABS[id].cssClass);
              }
              (TABS[id].removeClasses || []).forEach((cls) => {
                container.classList.remove(cls);
              });
            }

            // Then apply the new tab's classes
            if (tabConfig.cssClass) {
              container.classList.add(tabConfig.cssClass);
            }

            // Clear tables before loading new data
            document.getElementById("tableContainer").innerHTML = "";

            // Reset loading message state
            const loadingMessage = document.getElementById("loadingMessage");
            if (loadingMessage) {
              loadingMessage.innerHTML = "";
              loadingMessage.style.display = "none";
            }

            // Call the appropriate handler
            if (tabConfig.handler) {
              try {
                // Create a handlers object that maps names to functions
                const handlers = {
                  loadInventory,
                  loadCatalog,
                  loadUpload,
                };

                // Check if the handler exists
                if (typeof handlers[tabConfig.handler] === "function") {
                  await handlers[tabConfig.handler]();
                } else {
                  console.warn(
                    `Handler '${tabConfig.handler}' is not a function`
                  );
                }
              } catch (error) {
                console.error(`Error loading tab ${clickedTabId}:`, error);
                const errorMessage = document.createElement("div");
                errorMessage.className = "error-message";
                errorMessage.textContent = "Error loading content";
                container.appendChild(errorMessage);
              }
            } else {
              console.warn(`No handler found for tab: ${clickedTabId}`);
            }
          });
        }
      } catch (error) {
        console.error("Error loading content:", error);
        contentEl.innerHTML = "Error loading content";
      }
    } else {
      userRole = null; // Clear role on sign-out
      contentEl.style.display = "none";
      loginFormEl = document.getElementById("loginForm");

      if (!loginFormEl) {
        if (loadingEl) {
          loadingEl.remove();
        }
        createLoginForm();
      }
    }
  });
});

function createLoginForm() {
  const loginForm = document.createElement("div");
  loginForm.id = "loginForm";
  loginForm.className = "container";

  loginForm.innerHTML = `
    <img src="/assets/maquilalogo.png" alt="Logo industrias formex" width="150">
    <h2>Inicio de sesión</h2>
    <div id="loginError" class="error-message"></div>
    <form id="login">
      <div class="form-group">
        <label for="email">Correo electrónico</label>
        <input type="email" id="email" required />
      </div>
      <div class="form-group">
        <label for="password">Contraseña</label>
        <input type="password" id="password" required />
      </div>
      <button type="submit" class="btn">Iniciar sesión</button>
    </form>
  `;

  document.body.appendChild(loginForm);

  document.getElementById("login").addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorDiv = document.getElementById("loginError");

    errorDiv.textContent = "";

    signInWithEmailAndPassword(auth, email, password).catch((error) => {
      let errorMessage = "Error al iniciar sesión";

      switch (error.code) {
        case "auth/invalid-credential":
          errorMessage = "Correo o contraseña incorrectos";
          break;
        case "auth/user-disabled":
          errorMessage = "Esta cuenta ha sido deshabilitada";
          break;
        case "auth/user-not-found":
          errorMessage = "No existe una cuenta con este correo";
          break;
        case "auth/too-many-requests":
          errorMessage = "Demasiados intentos. Por favor, intente más tarde";
          break;
      }

      errorDiv.textContent = errorMessage;
    });
  });
}
