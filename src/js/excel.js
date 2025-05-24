import $ from "jquery";
import DataTable from "datatables.net-dt"; // Core DataTables
import "datatables.net-buttons-dt"; // Buttons styling for DataTables
import "datatables.net-buttons/js/buttons.html5.min.js"; // HTML5 export buttons

// Import JSZip
import JSZip from "jszip";

import { handleError } from "./utils/utils.min.js";
import { auth } from "./fb.js";

// Make JSZip globally available for DataTables HTML5 export buttons
window.JSZip = JSZip;

// Make DataTable available on jQuery (already present, good)
$.DataTable = DataTable;

async function loadInventory() {
  try {
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      try {
        loadingMessage.innerHTML =
          '<img src="/assets/loading.gif" alt="Cargando..." /> Cargando...';
      } catch (error) {
        loadingMessage.textContent = "Cargando..."; // Fallback if image fails
        console.warn("Loading image could not be displayed:", error);
      }
      loadingMessage.style.display = "block";
    }

    // Dynamic imports for the modules we need
    const [
      { extractName, extractPeriod, extractInventoryData, extractTotals },
      { displayInventoryTable },
    ] = await Promise.all([
      import("./utils/excelite.min.js"),
      import("./display/inventory.min.js"),
    ]);

    // Load Excel file
    const response = await fetch(
      `assets/${import.meta.env.VITE_INVENTORY_FILE}`
    );
    if (!response.ok) throw new Error("No se pudo cargar el archivo Excel");

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Extract data
    const extractedData = {
      name: extractName(sheet),
      period: extractPeriod(sheet),
      data: extractInventoryData(sheet),
      totals: extractTotals(sheet),
    };

    // Display data
    displayInventoryTable(extractedData);
  } catch (error) {
    handleError(error, "Error al cargar los datos");
  } finally {
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      loadingMessage.style.display = "none";
      loadingMessage.innerHTML = "";
    }
  }
}

async function loadCatalog() {
  try {
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      try {
        loadingMessage.innerHTML =
          '<img src="/assets/loading.gif" alt="Cargando..." /> Cargando...';
      } catch (error) {
        loadingMessage.textContent = "Cargando..."; // Fallback if image fails
        console.warn("Loading image could not be displayed:", error);
      }
      loadingMessage.style.display = "block";
    }

    const [{ extractCatalogData }, { displayCatalogTable }] = await Promise.all(
      [import("./utils/excelite.min.js"), import("./display/catalog.min.js")]
    );

    // Load Excel file
    const response = await fetch(
      `/assets/${import.meta.env.VITE_CATALOG_FILE}`
    );
    if (!response.ok) throw new Error("No se pudo cargar el catálogo");

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Extract and display data
    const catalogData = extractCatalogData(sheet);
    displayCatalogTable(catalogData);
  } catch (error) {
    handleError(error, "Error al cargar los datos del catálogo");
  } finally {
    const loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) {
      loadingMessage.style.display = "none";
      loadingMessage.innerHTML = "";
    }
  }
}

async function loadUpload() {
  const tableContainer = document.getElementById("tableContainer");
  if (!tableContainer) {
    console.error("Table container not found for upload view.");
    handleError(
      new Error("UI component missing"),
      "Error al preparar la vista de carga."
    );
    return;
  }

  const expectedInventoryFile = import.meta.env.VITE_INVENTORY_FILE;
  const expectedCatalogFile = import.meta.env.VITE_CATALOG_FILE;

  const response = await fetch("/pages/upload.html");
  if (!response.ok) {
    handleError(
      new Error(`Failed to load upload form: ${response.statusText}`),
      "Error al cargar formulario de subida"
    );
    return;
  }
  let htmlContent = await response.text();
  htmlContent = htmlContent.replace(
    /\$\{expectedInventoryFile\}/g,
    expectedInventoryFile
  );
  htmlContent = htmlContent.replace(
    /\$\{expectedCatalogFile\}/g,
    expectedCatalogFile
  );
  tableContainer.innerHTML = htmlContent;

  const inventoryFileInput = document.getElementById("inventoryFile");
  const catalogFileInput = document.getElementById("catalogFile");
  const submitButton = document.getElementById("submitUploadButton");
  const feedbackDiv = document.getElementById("uploadFeedback");
  const uploadLoadingMessage = document.getElementById("uploadLoadingMessage");

  if (submitButton) {
    submitButton.textContent = "Validar y Subir Archivos para Actualizar Sitio";
  }

  // Update document title for the upload view
  document.querySelector("#tab").textContent =
    "Actualizar Archivos (Automático)";
  const currentTitle = document.title;
  if (currentTitle.includes("|")) {
    const company = currentTitle.split("|")[1].trim();
    document.title = `Actualizar Archivos (Automático) | ${company}`;
  } else {
    document.title = "Actualizar Archivos (Automático)";
  }
  // Clear period and title specific to other views
  const periodEl = document.getElementById("period");
  if (periodEl) periodEl.textContent = "";
  const titleEl = document.getElementById("title");
  if (titleEl) titleEl.textContent = "Administración de Archivos";

  function showFeedback(message, isError = false, isInstructions = false) {
    feedbackDiv.textContent = message; // Use textContent to prevent XSS vulnerabilities
    feedbackDiv.className = isError
      ? "feedback-message error"
      : isInstructions
      ? "feedback-message instructions" // You might want a specific class for instructions
      : "feedback-message success";
    feedbackDiv.style.backgroundColor = isError
      ? "#f8d7da"
      : isInstructions
      ? "#e0e0e0" // A neutral color for instructions
      : "#d4edda";
    feedbackDiv.style.color = isError
      ? "#721c24"
      : isInstructions
      ? "#333"
      : "#155724";
    feedbackDiv.style.borderColor = isError
      ? "#f5c6cb"
      : isInstructions
      ? "#ccc"
      : "#c3e6cb";
    feedbackDiv.style.display = "block";
    feedbackDiv.style.textAlign = isInstructions ? "left" : "center";
    if (isInstructions) {
      feedbackDiv.style.padding = "15px";
      feedbackDiv.style.lineHeight = "1.6";
    }
  }

  submitButton.addEventListener("click", async () => {
    feedbackDiv.style.display = "none"; // Hide previous messages
    uploadLoadingMessage.style.display = "block";
    submitButton.disabled = true;
    submitButton.style.opacity = "0.7";

    const inventoryFile = inventoryFileInput.files[0];
    const catalogFile = catalogFileInput.files[0];
    const formData = new FormData();
    let filesToUploadCount = 0;
    let validationErrorOccurred = false;

    // --- Inventory File Handling ---
    if (inventoryFile) {
      if (inventoryFile.name !== expectedInventoryFile) {
        showFeedback(
          `El archivo de inventario debe llamarse "${expectedInventoryFile}". Archivo seleccionado: "${inventoryFile.name}"`,
          true
        );
        validationErrorOccurred = true;
      } else if (!inventoryFile.name.endsWith(".xlsx")) {
        showFeedback("El archivo de inventario debe ser de tipo .xlsx.", true);
        validationErrorOccurred = true;
      } else {
        formData.append("inventoryFile", inventoryFile, expectedInventoryFile);
        filesToUploadCount++;
      }
    }

    // --- Catalog File Handling ---
    if (catalogFile) {
      if (catalogFile.name !== expectedCatalogFile) {
        showFeedback(
          `El archivo de catálogo debe llamarse "${expectedCatalogFile}". Archivo seleccionado: "${catalogFile.name}"`,
          true
        );
        validationErrorOccurred = true;
      } else if (!catalogFile.name.endsWith(".xls")) {
        showFeedback("El archivo de catálogo debe ser de tipo .xls.", true);
        validationErrorOccurred = true;
      } else {
        formData.append("catalogFile", catalogFile, expectedCatalogFile);
        filesToUploadCount++;
      }
    }

    // --- Final Validation Check ---
    // If a validation error occurred for any file that was present
    if (validationErrorOccurred) {
      uploadLoadingMessage.style.display = "none";
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
      return;
    }

    // If no valid files were selected to upload
    if (filesToUploadCount === 0) {
      showFeedback(
        "Por favor, seleccione al menos un archivo válido (inventario o catálogo) para subir.",
        true
      );
      uploadLoadingMessage.style.display = "none";
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
      return;
    }

    // If validations pass for at least one file, attempt to upload to Docker server
    uploadLoadingMessage.innerHTML =
      '<img src="/assets/loading.gif" alt="Procesando..." width="24" style="vertical-align: middle; margin-right: 8px;" /> Procesando y subiendo archivo(s)...';

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        showFeedback(
          "Error de autenticación: No se pudo obtener el usuario actual. Por favor, recargue la página e intente de nuevo.",
          true
        );
        uploadLoadingMessage.style.display = "none";
        submitButton.disabled = false;
        submitButton.style.opacity = "1";
        return;
      }

      const idToken = await currentUser.getIdToken(true); // Force refresh token

      const dockerServer = import.meta.env.VITE_DOCKER_SERVER_ENDPOINT;
      const dockerServerEndpoint = `${dockerServer}/api/update-excel-files`;

      showFeedback(
        "Enviando archivos al servidor para actualización automática. Esto puede tardar unos momentos...",
        false,
        true
      );

      const uploadResponse = await fetch(dockerServerEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          // 'Content-Type': 'multipart/form-data' is usually set automatically by browser with FormData
        },
        body: formData,
      });

      uploadLoadingMessage.style.display = "none";

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse
          .json()
          .catch(() => ({ message: "Error desconocido del servidor." }));
        throw new Error(
          `Error del servidor (${uploadResponse.status}): ${
            errorData.message || uploadResponse.statusText
          }`
        );
      }

      const result = await uploadResponse.json();
      showFeedback(
        result.message ||
          "Archivos procesados y sitio web en proceso de actualización. Puede tardar unos minutos en reflejarse.",
        false
      );
      inventoryFileInput.value = ""; // Clear inputs on success
      catalogFileInput.value = "";
    } catch (error) {
      console.error("Error during automated upload process:", error);
      showFeedback(
        `Error al intentar actualizar automáticamente: ${error.message}`,
        true
      );
      uploadLoadingMessage.style.display = "none";
    } finally {
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
    }
  });
}

export { loadInventory, loadCatalog, loadUpload };
