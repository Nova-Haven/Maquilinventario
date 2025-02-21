import $ from "jquery";
import DataTable from "datatables.net-dt";
import languageES from "datatables.net-plugins/i18n/es-ES.mjs";

// Make DataTable available on jQuery
$.DataTable = DataTable;

let XLSX;

async function loadExcel() {
  const xlsxModule = await import("xlsx");
  XLSX = xlsxModule.default;
  const tableContainer = document.getElementById("excelTable");
  const loadingMessage = document.createElement("div");
  loadingMessage.textContent = "Cargando datos...";
  tableContainer.parentNode.insertBefore(loadingMessage, tableContainer);

  try {
    const response = await fetch("/data/" + import.meta.env.VITE_EXCEL_FILE);
    if (!response.ok) throw new Error("No se pudo cargar el archivo Excel");

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const extractedData = {
      period: extractPeriod(sheet),
      data: extractMainData(sheet),
      totals: extractTotals(sheet),
    };

    displayTable(extractedData);
  } catch (error) {
    console.error("Error:", error);
    loadingMessage.textContent = "Error al cargar los datos";
  } finally {
    loadingMessage.remove();
  }
}

function extractPeriod(sheet) {
  const periodCell = sheet["A4"] || {};
  const periodText = periodCell.v || "";
  const matches = periodText.match(/Del: (.*?) Al: (.*?)$/);
  return {
    start: matches?.[1] || "",
    end: matches?.[2] || "",
  };
}

function extractMainData(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find where the main data ends (where notes begin)
  const notesStartIndex = data.findIndex(
    (row, index) => index > 8 && row[1] && row[1].toString().startsWith("(1)")
  );

  // Extract only the main data rows
  const mainData = data
    .slice(7, notesStartIndex)
    .map((row) => ({
      producto: row[1],
      nombre: row[2],
      metodo_costeo: row[3]?.replace(/^Costo\s+/i, "") || "",
      unidades: {
        inventario_inicial: row[5],
        entradas: row[6],
        salidas: row[7],
        existencia: row[8],
      },
      importes: {
        inventario_inicial: row[9],
        entradas: row[10],
        salidas: row[11],
        inventario_final: row[12],
      },
      error: row[13],
    }))
    .filter((row) => row.producto);

  // Extract notes separately
  const notes = data
    .slice(notesStartIndex)
    .filter((row) => row[1])
    .map((row) => row[1]);

  return {
    mainData,
    notes,
  };
}

function formatNumber(num) {
  if (num === undefined || num === null) return "0";
  return num.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function extractTotals(sheet) {
  // Find the totals row (it's right after the last data row)
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const lastDataIndex = data.findIndex(
    (row, index) => index > 8 && (!row[1] || row[1] === "")
  );
  const totalsRow = data[lastDataIndex];

  if (!totalsRow) return null;

  return {
    unidades: {
      inventario_inicial: totalsRow[5],
      entradas: totalsRow[6],
      salidas: totalsRow[7],
      existencia: totalsRow[8],
    },
    importes: {
      inventario_inicial: totalsRow[9],
      entradas: totalsRow[10],
      salidas: totalsRow[11],
      inventario_final: totalsRow[12],
    },
  };
}

function displayTable(data) {
  const tableHead = document.querySelector("#excelTable thead");
  const tableBody = document.querySelector("#excelTable tbody");
  const periodText = `${data.period.start} al ${data.period.end}`;
  document.querySelector("#period").textContent = periodText;

  // Clear existing content
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  // Create column groups header
  const headerGroup = document.createElement("tr");
  [
    { text: "", colspan: 3 },
    { text: "Unidades", colspan: 4 },
    { text: "Importes", colspan: 4 },
    { text: "", colspan: 1 },
  ].forEach((group) => {
    const th = document.createElement("th");
    th.textContent = group.text;
    th.colSpan = group.colspan;
    th.style.textAlign = "center";
    headerGroup.appendChild(th);
  });
  tableHead.appendChild(headerGroup);

  // Create subheaders
  const subHeaderRow = document.createElement("tr");
  [
    "Producto",
    "Nombre",
    "M. Costeo",
    "Inv. Inicial",
    "Entradas",
    "Salidas",
    "Existencia",
    "Inv. Inicial",
    "Entradas",
    "Salidas",
    "Inv. Final",
    "Err.",
  ].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    subHeaderRow.appendChild(th);
  });
  tableHead.appendChild(subHeaderRow);

  // Create body rows
  data.data.mainData.forEach((row) => {
    const tr = document.createElement("tr");
    [
      row.producto,
      row.nombre,
      row.metodo_costeo,
      row.unidades.inventario_inicial,
      row.unidades.entradas,
      row.unidades.salidas,
      row.unidades.existencia,
      row.importes.inventario_inicial,
      row.importes.entradas,
      row.importes.salidas,
      row.importes.inventario_final,
      row.error,
    ].forEach((cell, index) => {
      const td = document.createElement("td");

      // Special handling for error column
      if (index === 11 && cell) {
        td.textContent = cell; // Show the error number

        // Find matching note
        const note = data.data.notes.find((note) =>
          note.startsWith(`(${cell})`)
        );

        if (note) {
          td.classList.add("has-tooltip");
          td.title = note; // Add tooltip with full note text
        }
      } else {
        // Normal cell handling
        td.textContent = cell !== undefined && cell !== null ? cell : "0";
      }

      // Add number-cell class for numeric columns (excluding error column)
      if (index >= 3 && index <= 10) {
        td.textContent = formatNumber(Number(cell));
        td.classList.add("number-cell");
      }

      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  // Create totals row
  const totalsRow = document.createElement("tr");
  const tableFoot = document.createElement("tfoot");
  [
    "Totales",
    "",
    "",
    data.totals.unidades.inventario_inicial,
    data.totals.unidades.entradas,
    data.totals.unidades.salidas,
    data.totals.unidades.existencia,
    data.totals.importes.inventario_inicial,
    data.totals.importes.entradas,
    data.totals.importes.salidas,
    data.totals.importes.inventario_final,
    "",
  ].forEach((cell, index) => {
    const td = document.createElement("td");
    td.textContent = cell !== undefined && cell !== null ? cell : "0";

    // Add number-cell class for numeric columns
    if (index >= 3 && index <= 10) {
      td.textContent = formatNumber(Number(cell));
      td.classList.add("number-cell");
    }

    totalsRow.appendChild(td);
  });

  // Add the totals row to the table footer
  tableFoot.appendChild(totalsRow);
  document.querySelector("#excelTable").appendChild(tableFoot);

  // Initialize DataTable
  const defaultPageLength = 10;
  $("#excelTable").DataTable({
    order: [],
    responsive: true,
    pageLength: defaultPageLength,
    lengthMenu: [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, "Todos"],
    ],
    language: {
      ...languageES,
      lengthMenu: "_MENU_ por página",
      searchPlaceholder: "Buscar...",
    },
    dom: '<"datatable-header"<"left"l><"center"B><"right"f>>rt<"datatable-footer"<"pagination-wrapper"<"pagination-info"i><"pagination-controls"p>>>',
    scrollX: false,
    //scrollY: "60vh",
    //scrollCollapse: true,
    fixedHeader: true,
    paging: true,
    autoWidth: false,
    columnDefs: [
      { width: "25%", target: 1 },
      { width: "6%", target: 2 },
      { width: "3%", target: 11 },
    ],
  });
}

export { loadExcel };
