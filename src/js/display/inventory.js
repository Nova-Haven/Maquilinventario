import { formatNumber } from "../utils/utils.min.js";

export function displayInventoryTable(data) {
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
  const title = "Inventario | " + data.name;
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

  // Import DataTables functionality on demand
  import("../utils/initInventory.min.js").then((module) => {
    module.initInventory(data, title, periodText);
  });
}
