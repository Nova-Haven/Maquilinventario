import $ from "jquery";
import languageES from "datatables.net-plugins/i18n/es-ES.mjs";

const Swal = window.Swal;

export function initInventory(data, title, periodText) {
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

              const tableBody = exportData.body;
              tableBody.pop(); // Remove totals row

              const headers = exportData.header;

              const totalsRowArray = [];
              $("#inventoryTable tfoot tr:first")
                .find("td, th")
                .each(function () {
                  totalsRowArray.push($(this).text());
                });

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
                      widths: Array(headers.length).fill("auto"),
                      body: [
                        headers, // Header row as array
                        ...tableBody, // Data rows as arrays
                        totalsRowArray, // Totals row as array
                      ],
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
                },
                defaultStyle: {
                  fontSize: 9,
                },
              };

              // Generate PDF
              const generatePDF = () => {
                // Use the global pdfMake object from CDN
                if (window.pdfMake) {
                  window.pdfMake
                    .createPdf(docDefinition)
                    .download(`${title} - ${periodText}.pdf`);
                } else {
                  console.error(
                    "pdfMake is not available. Check your CDN imports."
                  );
                  Swal.fire({
                    title: "Error",
                    text: "No se pudo generar el PDF: pdfMake no está disponible",
                    icon: "error",
                  });
                }
              };

              generatePDF();

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
    scrollX: false,
    fixedHeader: true,
    paging: true,
    autoWidth: false,
    columnDefs: [
      { width: "15%", target: 1 },
      { width: "6%", target: 2 },
      { width: "7%", target: 3 },
    ],
  });
}
