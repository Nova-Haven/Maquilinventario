import $ from "jquery";
import "datatables.net-buttons";
import "datatables.net-buttons-dt";
import "datatables.net-buttons/js/buttons.html5.min.js";
import { handleError } from "./utils/utils.min.js";
import DataTable from "datatables.net-dt";
import { auth } from "./fb.js";

// Make DataTable available on jQuery
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
    feedbackDiv.innerHTML = message; // Use innerHTML to allow for HTML in instructions
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
    let validationError = false;

    // --- Inventory File Validation ---
    if (!inventoryFile) {
      showFeedback("Por favor, seleccione el archivo de inventario.", true);
      validationError = true;
    } else if (inventoryFile.name !== expectedInventoryFile) {
      showFeedback(
        `El archivo de inventario debe llamarse "${expectedInventoryFile}". Archivo seleccionado: "${inventoryFile.name}"`,
        true
      );
      validationError = true;
    } else if (!inventoryFile.name.endsWith(".xlsx")) {
      showFeedback("El archivo de inventario debe ser de tipo .xlsx.", true);
      validationError = true;
    }

    // --- Catalog File Validation (only if inventory validation passed) ---
    if (!validationError) {
      if (!catalogFile) {
        showFeedback("Por favor, seleccione el archivo de catálogo.", true);
        validationError = true;
      } else if (catalogFile.name !== expectedCatalogFile) {
        showFeedback(
          `El archivo de catálogo debe llamarse "${expectedCatalogFile}". Archivo seleccionado: "${catalogFile.name}"`,
          true
        );
        validationError = true;
      } else if (!catalogFile.name.endsWith(".xls")) {
        showFeedback("El archivo de catálogo debe ser de tipo .xls.", true);
        validationError = true;
      }
    }

    if (validationError) {
      uploadLoadingMessage.style.display = "none";
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
      return;
    }

    // If validations pass, attempt to upload to Docker server
    uploadLoadingMessage.innerHTML =
      '<img src="/assets/loading.gif" alt="Procesando..." width="24" style="vertical-align: middle; margin-right: 8px;" /> Procesando y subiendo archivos...';
    uploadLoadingMessage.style.display = "block"; // Ensure it's visible

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

      const formData = new FormData();
      formData.append("inventoryFile", inventoryFile, expectedInventoryFile);
      formData.append("catalogFile", catalogFile, expectedCatalogFile);
      const dockerServer = import.meta.env.VITE_DOCKER_SERVER_ENDPOINT; // Corrected variable name

      const dockerServerEndpoint = `${dockerServer}/api/update-excel-files`; // Removed trailing quote

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
