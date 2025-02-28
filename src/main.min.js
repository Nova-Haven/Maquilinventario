import { auth } from './js/fb.min';
import {} from 'xlsx';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import './style.min.css';
document.addEventListener('DOMContentLoaded', function () {
  const loadingEl = document.getElementById('loading'),
    contentEl = document.getElementById('content');
  onAuthStateChanged(auth, async (user) => {
    let loginFormEl;
    if ((loadingEl.remove(), user)) {
      const { loadExcel: loadExcel } = await import('./js/excel.min.js');
      (loginFormEl = document.getElementById('loginForm')),
        loginFormEl && loginFormEl.remove(),
        (contentEl.style.display = 'block');
      try {
        const response = await fetch('/pages/excel.html'),
          html = await response.text();
        (contentEl.innerHTML = html), loadExcel();
      } catch (error) {
        console.error('Error loading content:', error),
          (contentEl.innerHTML = 'Error loading content');
      }
    } else
      (contentEl.style.display = 'none'),
        (loginFormEl = document.getElementById('loginForm')),
        loginFormEl ||
          (loadingEl.remove(),
          (function () {
            const loginForm = document.createElement('div');
            (loginForm.id = 'loginForm'),
              (loginForm.className = 'container'),
              (loginForm.innerHTML =
                '\n       <img src="src/maquilalogo.png" alt="Logo industrias formex" width="150">  <h2>Inicio de sesión</h2>\n        <div id="loginError" class="error-message"></div>\n        <form id="login">\n          <div class="form-group">\n            <label for="email">Correo electrónico</label>\n            <input type="email" id="email" required />\n          </div>\n          <div class="form-group">\n            <label for="password">Contraseña</label>\n            <input type="password" id="password" required />\n          </div>\n          <button type="submit" class="btn">Iniciar sesión</button>\n        </form>\n      '),
              document.body.appendChild(loginForm),
              document
                .getElementById('login')
                .addEventListener('submit', (e) => {
                  e.preventDefault();
                  const email = document.getElementById('email').value,
                    password = document.getElementById('password').value,
                    errorDiv = document.getElementById('loginError');
                  (errorDiv.textContent = ''),
                    signInWithEmailAndPassword(auth, email, password).catch(
                      (error) => {
                        let errorMessage = 'Error al iniciar sesión';
                        switch (error.code) {
                          case 'auth/invalid-credential':
                            errorMessage = 'Correo o contraseña incorrectos';
                            break;
                          case 'auth/user-disabled':
                            errorMessage = 'Esta cuenta ha sido deshabilitada';
                            break;
                          case 'auth/user-not-found':
                            errorMessage =
                              'No existe una cuenta con este correo';
                            break;
                          case 'auth/too-many-requests':
                            errorMessage =
                              'Demasiados intentos. Por favor, intente más tarde';
                        }
                        errorDiv.textContent = errorMessage;
                      }
                    );
                });
          })());
  });
});
