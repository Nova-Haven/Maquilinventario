const XLSX = window.XLSX;

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

export {
  extractPeriod,
  extractName,
  extractInventoryData,
  extractCatalogData,
  extractTotals,
};
