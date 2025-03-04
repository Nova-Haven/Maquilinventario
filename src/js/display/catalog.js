import { formatNumber } from "../utils/utils.min.js";

export function displayCatalogTable(data) {
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

  // Import DataTables functionality on demand
  import("../utils/initCatalog.min.js").then((module) => {
    module.initCatalogDataTable();
  });
}
