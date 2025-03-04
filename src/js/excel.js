import $ from "jquery";
import languageES from "datatables.net-plugins/i18n/es-ES.mjs";
import "datatables.net-buttons/js/buttons.colVis.mjs";
import "datatables.net-buttons/js/buttons.html5.mjs";
import "datatables.net-buttons/js/buttons.print.mjs";
import pdfFonts from "pdfmake/build/vfs_fonts";
import pdfMake from "pdfmake/build/pdfmake";
import DataTable from "datatables.net-dt";
import "datatables.net-buttons";
import Swal from "sweetalert2";
import JSZip from "jszip";

// Make DataTable available on jQuery
$.DataTable = DataTable;
window.JSZip = JSZip;
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

let XLSX;

async function loadInventory() {
  const xlsxModule = await import("xlsx");
  XLSX = xlsxModule.default;
  const tableContainer = document.getElementById("inventoryTable");
  const loadingMessage = document.getElementById("loadingMessage");
  if (loadingMessage) {
    loadingMessage.innerHTML =
      '<img src="/assets/loading.gif" alt="Cargando..." /> Cargando...';
    loadingMessage.style.display = "block";
  }
  if (tableContainer) {
    tableContainer.parentNode.insertBefore(loadingMessage, tableContainer);
  }

  try {
    const response = await fetch(
      `assets/${import.meta.env.VITE_INVENTORY_FILE}`
    );
    if (!response.ok) throw new Error("No se pudo cargar el archivo Excel");

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const extractedData = {
      name: extractName(sheet),
      period: extractPeriod(sheet),
      data: extractInventoryData(sheet),
      totals: extractTotals(sheet),
    };

    displayInventoryTable(extractedData);
  } catch (error) {
    console.error("Error:", error);
    loadingMessage.textContent = "Error al cargar los datos";
  } finally {
    if (loadingMessage) {
      loadingMessage.style.display = "none";
      loadingMessage.innerHTML = ""; // Clear content
    }
  }
}

async function loadCatalog() {
  const xlsxModule = await import("xlsx");
  XLSX = xlsxModule.default;
  const tableContainer = document.getElementById("catalogTable");
  const loadingMessage = document.getElementById("loadingMessage");
  if (loadingMessage) {
    loadingMessage.innerHTML =
      '<img src="/assets/loading.gif" alt="Cargando..." /> Cargando...';
    loadingMessage.style.display = "block";
  }

  if (tableContainer) {
    tableContainer.parentNode.insertBefore(loadingMessage, tableContainer);
  }

  try {
    const response = await fetch(`assets/${import.meta.env.VITE_CATALOG_FILE}`);
    if (!response.ok) throw new Error("No se pudo cargar el catálogo");

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    // Get first sheet only
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const catalogData = extractCatalogData(sheet);
    displayCatalogTable(catalogData);
  } catch (error) {
    console.error("Error:", error);
    loadingMessage.textContent = "Error al cargar los datos del catálogo";
  } finally {
    if (loadingMessage) {
      loadingMessage.style.display = "none";
      loadingMessage.innerHTML = ""; // Clear content
    }
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

function extractName(sheet) {
  const periodCell = sheet["C1"] || {};
  const periodText = periodCell.v || "";
  return periodText;
}

function extractInventoryData(sheet) {
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

function extractCatalogData(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find header row (row 3) and extract column headers
  const headerRow = data[2] || [];

  // Extract data starting from row 4 (index 3)
  const catalogItems = data
    .slice(3)
    .filter((row) => row.length > 0 && row[0]) // Filter out empty rows
    .map((row) => ({
      codigo: row[0] || "",
      nombre: row[1] || "",
      precio: row[2] || 0,
      fraccion: row[3] || "",
      descripcion: row[4] || "",
      fraccion2: row[5] || "",
      observaciones: row[6] || "",
    }));

  return {
    headers: headerRow,
    items: catalogItems,
  };
}

function formatNumber(num) {
  if (num === undefined || num === null) return "0";
  return num.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date) {
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const day = date.getDate().toString().padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
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

function toTitleCase(str) {
  // Special cases for Mexican company suffixes
  const specialCases = {
    "sa de cv": "SA de CV",
    "sapi de cv": "SAPI de CV",
    "srl de cv": "SRL de CV",
    "s de rl": "S de RL",
    "s de rl de cv": "S de RL de CV",
    "sc de rl": "SC de RL",
  };

  // Words to keep lowercase (prepositions and articles)
  const lowercaseWords = [
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "y",
    "e",
    "o",
    "u",
  ];

  // First convert the string to lowercase
  const lowerStr = str.toLowerCase();

  // Check for company suffix at the end of the string
  for (const [suffix, replacement] of Object.entries(specialCases)) {
    if (lowerStr.endsWith(` ${suffix}`)) {
      // Split the string to separate the company name and suffix
      const mainPart = str.slice(0, -suffix.length).trim();
      // Title case the main part while keeping certain words lowercase
      const titleCased = mainPart
        .toLowerCase()
        .split(" ")
        .map((word, index) => {
          // Always capitalize first word
          if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
          // Keep certain words lowercase
          if (lowercaseWords.includes(word)) return word;
          // Capitalize other words
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");

      return `${titleCased} ${replacement}`;
    }
  }

  // If no special suffix found, apply the same title case rules
  return str
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      if (lowercaseWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function displayInventoryTable(data) {
  const tableContainer = document.getElementById("tableContainer");
  tableContainer.innerHTML = `
    <table id="inventoryTable">
      <thead></thead>
      <tbody></tbody>
    </table>
  `;
  const tableHead = document.querySelector("#inventoryTable thead");
  const tableBody = document.querySelector("#inventoryTable tbody");
  const periodText = `${data.period.start} al ${data.period.end}`;
  const title = "Inventario | " + toTitleCase(data.name);
  document.querySelector("#title").textContent = data.name;
  document.querySelector("#period").textContent = periodText;
  document.querySelector("#tab").textContent = "Inventario";
  document.title = title;

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
      if (index === 11) {
        if (cell) {
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
          // Leave empty for error column when no error
          td.textContent = "";
        }
      } else {
        // Normal cell handling (for non-error columns)
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
  document.querySelector("#inventoryTable").appendChild(tableFoot);

  // Initialize DataTable
  const defaultPageLength = 10;
  $("#inventoryTable").DataTable({
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
    buttons: [
      {
        extend: "pdfHtml5",
        text: '<i class="fa fa-file-pdf-o"></i> Exportar PDF',
        titleAttr: "Exportar a PDF",
        className: "btn-export btn-pdf",
        exportOptions: {
          columns: ":visible",
        },
        orientation: "landscape",
        pageSize: "LEGAL",
        title: `${title} - ${periodText}`,
        action: function (e, dt, button, config) {
          // Show loading
          const loadingAlert = Swal.fire({
            title: "Generando PDF...",
            text: "Por favor espere...",
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          // Use a timeout to ensure the alert shows up
          setTimeout(() => {
            try {
              // Get table data
              const exportData = dt.buttons.exportData(config.exportOptions);

              const title = document.title.split("|")[0].trim();
              const company = document.title.split("|")[1].trim();

              // Create document definition
              const docDefinition = {
                pageSize: "LEGAL",
                pageOrientation: "landscape",
                content: [
                  { text: company, style: "header" },
                  { text: title, style: "subtitle" },
                  { text: periodText, style: "subHeaderRow" },
                  {
                    margin: [0, 10, 0, 10],
                    stack: [
                      {
                        columns: [
                          {
                            text: `RFC: ${
                              document.getElementById("rfc")?.textContent || ""
                            }`,
                            fontSize: 10,
                            width: "50%",
                          },
                          {
                            text: `IMMEX: ${
                              document.getElementById("immex")?.textContent ||
                              ""
                            }`,
                            fontSize: 10,
                            width: "50%",
                          },
                        ],
                      },
                      {
                        text: `Domicilio fiscal: ${
                          document.getElementById("financialAddr")
                            ?.textContent || ""
                        }`,
                        fontSize: 10,
                        margin: [0, 5, 0, 0],
                      },
                    ],
                  },
                  {
                    table: {
                      headerRows: 1,
                      widths: Array(exportData.header.length).fill("auto"),
                      body: [exportData.header, ...exportData.body],
                    },
                    layout: {
                      hLineWidth: () => 0.5,
                      vLineWidth: () => 0.5,
                      hLineColor: () => "#aaa",
                      vLineColor: () => "#aaa",
                      fillColor: (i) => (i % 2 === 0 ? "#f8f8f8" : null),
                    },
                  },
                  {
                    text: "Leyenda de errores de existencia o costos:",
                    style: "subheader",
                    margin: [0, 15, 0, 5],
                  },
                  {
                    table: {
                      headerRows: 0,
                      widths: ["3%", "97%"],
                      body: data.data.notes.map((note) => {
                        // Extract code and description from note text (e.g., "(1) Some error description")
                        const match = note.match(/^\((\d+)\)\s*(.*)/);
                        if (match) {
                          return [
                            { text: match[1], alignment: "center", bold: true }, // Error code
                            { text: match[2].trim() }, // Error description
                          ];
                        }
                        return [{ text: "", alignment: "center" }, note]; // Fallback if format doesn't match
                      }),
                    },
                    layout: {
                      hLineWidth: function () {
                        return 0;
                      },
                      vLineWidth: function () {
                        return 0;
                      },
                      hLineColor: function () {
                        return "#aaaaaa";
                      },
                      vLineColor: function () {
                        return "#aaaaaa";
                      },
                      paddingLeft: function () {
                        return 5;
                      },
                      paddingRight: function () {
                        return 5;
                      },
                      paddingTop: function () {
                        return 3;
                      },
                      paddingBottom: function () {
                        return 3;
                      },
                    },
                    style: "errorTable",
                    margin: [0, 0, 0, 10],
                  },
                ],
                styles: {
                  header: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 0, 0, 10],
                    alignment: "center",
                  },
                  subtitle: {
                    fontSize: 12,
                    bold: true,
                    margin: [0, 0, 0, 10],
                    alignment: "center",
                  },
                  subHeaderRow: {
                    fontSize: 10,
                    bold: true,
                    margin: [0, 0, 0, 10],
                    alignment: "center",
                  },
                  tableHeader: {
                    fontSize: 10,
                    bold: true,
                    alignment: "center",
                  },
                  errorTable: {
                    fontSize: 9,
                    margin: [0, 5, 0, 15],
                  },
                },
                defaultStyle: {
                  fontSize: 9,
                },
              };

              // Generate PDF
              pdfMake
                .createPdf(docDefinition)
                .download(`${title} - ${periodText}.pdf`);

              // Show success after a delay
              setTimeout(() => {
                Swal.fire({
                  title: "PDF Generado",
                  text: "El documento ha sido generado exitosamente",
                  icon: "success",
                  timer: 2000,
                  timerProgressBar: true,
                });
              }, 500);
            } catch (error) {
              console.error("Error generating PDF:", error);
              Swal.fire({
                title: "Error",
                text: "No se pudo generar el PDF",
                icon: "error",
              });
            }
          }, 300);
        },
      },
    ],
    // Update DOM to include buttons
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

function displayCatalogTable(data) {
  document.querySelector("#tab").textContent = "Catálogo de Productos";

  // Get the current title
  const currentTitle = document.title;
  // Check if it contains a pipe
  if (currentTitle.includes("|")) {
    // Keep the part after the pipe
    const company = currentTitle.split("|")[1].trim();
    document.title = `Catálogo de Productos | ${company}`;
  } else {
    // If there's no pipe, just set a new title
    document.title = "Catálogo de Productos";
  }

  const tableContainer = document.getElementById("tableContainer");

  // Clear existing content
  tableContainer.innerHTML = `
    <table id="catalogTable" class="display">
      <thead>
        <tr></tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tableHead = document.querySelector("#catalogTable thead tr");
  const tableBody = document.querySelector("#catalogTable tbody");

  // Add headers
  [
    "Código",
    "Nombre",
    "Precio",
    "Fracción",
    "Descripción",
    "Fracción",
    "Observaciones",
  ].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    tableHead.appendChild(th);
  });

  // Add data rows
  data.items.forEach((item) => {
    const tr = document.createElement("tr");

    [
      item.codigo,
      item.nombre,
      item.precio,
      item.fraccion,
      item.descripcion,
      item.fraccion2,
      item.observaciones,
    ].forEach((cell, index) => {
      const td = document.createElement("td");

      // Format price as currency
      if (index === 2) {
        td.textContent = formatNumber(Number(cell));
        td.classList.add("number-cell");
      } else {
        td.textContent = cell;
      }

      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  // Initialize DataTable
  $("#catalogTable").DataTable({
    order: [],
    responsive: true,
    pageLength: 15,
    lengthMenu: [
      [10, 15, 25, 50, 100, -1],
      [10, 15, 25, 50, 100, "Todos"],
    ],
    language: {
      ...languageES,
      lengthMenu: "_MENU_ por página",
      searchPlaceholder: "Buscar...",
    },
    buttons: [
      {
        extend: "pdfHtml5",
        text: '<i class="fa fa-file-pdf-o"></i> Exportar PDF',
        titleAttr: "Exportar a PDF",
        className: "btn-export btn-pdf",
        exportOptions: {
          columns: ":visible",
        },
        orientation: "landscape",
        pageSize: "LETTER",
        title: `Catálogo de Productos`,
        action: function (e, dt, button, config) {
          // Show loading
          const loadingAlert = Swal.fire({
            title: "Generando PDF...",
            text: "Por favor espere...",
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          const pdfTitle = "Catálogo de Productos";
          const company = document.title.split("|")[1].trim();

          // Use a timeout to ensure the alert shows up
          setTimeout(() => {
            try {
              // Get table data
              const exportData = dt.buttons.exportData(config.exportOptions);

              // Create document definition
              const docDefinition = {
                pageSize: "LEGAL",
                pageOrientation: "landscape",
                content: [
                  { text: company, style: "header" },
                  { text: pdfTitle, style: "subtitle" },
                  {
                    margin: [0, 10, 0, 10],
                    stack: [
                      {
                        columns: [
                          {
                            text: `RFC: ${
                              document.getElementById("rfc")?.textContent || ""
                            }`,
                            fontSize: 10,
                            width: "50%",
                          },
                          {
                            text: `IMMEX: ${
                              document.getElementById("immex")?.textContent ||
                              ""
                            }`,
                            fontSize: 10,
                            width: "50%",
                          },
                        ],
                      },
                      {
                        text: `Domicilio fiscal: ${
                          document.getElementById("financialAddr")
                            ?.textContent || ""
                        }`,
                        fontSize: 10,
                        margin: [0, 5, 0, 0],
                      },
                    ],
                  },
                  {
                    table: {
                      headerRows: 1,
                      widths: Array(exportData.header.length).fill("auto"),
                      body: [exportData.header, ...exportData.body],
                    },
                    layout: {
                      hLineWidth: () => 0.5,
                      vLineWidth: () => 0.5,
                      hLineColor: () => "#aaa",
                      vLineColor: () => "#aaa",
                      fillColor: (i) => (i % 2 === 0 ? "#f8f8f8" : null),
                    },
                  },
                ],
                styles: {
                  header: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 0, 0, 10],
                    alignment: "center",
                  },
                  subtitle: {
                    fontSize: 12,
                    bold: true,
                    margin: [0, 0, 0, 10],
                    alignment: "center",
                  },
                  tableHeader: {
                    fontSize: 10,
                    bold: true,
                    alignment: "center",
                  },
                  errorTable: {
                    fontSize: 9,
                    margin: [0, 5, 0, 15],
                  },
                },
                defaultStyle: {
                  fontSize: 9,
                },
              };

              // Generate PDF
              pdfMake
                .createPdf(docDefinition)
                .download(`${pdfTitle} - ${formatDate(new Date())}.pdf`);

              // Show success after a delay
              setTimeout(() => {
                Swal.fire({
                  title: "PDF Generado",
                  text: "El documento ha sido generado exitosamente",
                  icon: "success",
                  timer: 2000,
                  timerProgressBar: true,
                });
              }, 500);
            } catch (error) {
              console.error("Error generating PDF:", error);
              Swal.fire({
                title: "Error",
                text: "No se pudo generar el PDF",
                icon: "error",
              });
            }
          }, 300);
        },
      },
    ],
    dom: '<"datatable-header"<"left"l><"center"B><"right"f>>rt<"datatable-footer"<"pagination-wrapper"<"pagination-info"i><"pagination-controls"p>>>',
    fixedHeader: true,
    autoWidth: false,
  });
}

export { loadInventory, loadCatalog };
