import $ from "jquery";
import "datatables.net-buttons";
import pdfFonts from "pdfmake/build/vfs_fonts";
import pdfMake from "pdfmake/build/pdfmake";
import DataTable from "datatables.net-dt";
import JSZip from "jszip";
import { handleError } from "./utils/utils.min.js";

// Make DataTable available on jQuery
$.DataTable = DataTable;
window.JSZip = JSZip;
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

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
      {
        initializeXLSX,
        extractName,
        extractPeriod,
        extractInventoryData,
        extractTotals,
      },
      { displayInventoryTable },
    ] = await Promise.all([
      import("./utils/excel.min.js"),
      import("./display/inventory.min.js"),
    ]);

    // Initialize XLSX
    const XLSX = await initializeXLSX();

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

    // Dynamic imports for the modules we need
    const [{ initializeXLSX, extractCatalogData }, { displayCatalogTable }] =
      await Promise.all([
        import("./utils/excel.min.js"),
        import("./display/catalog.min.js"),
      ]);

    // Initialize XLSX
    const XLSX = await initializeXLSX();

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

export { loadInventory, loadCatalog };
