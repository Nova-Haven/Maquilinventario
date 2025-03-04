import $ from "jquery";
import languageES from "datatables.net-plugins/i18n/es-ES.mjs";
import pdfMake from "pdfmake/build/pdfmake";
import Swal from "sweetalert2";
import { formatDate } from "./utils.min.js";

export function initCatalog() {
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

          // Safety check for company name extraction
          let company = "";
          try {
            if (document.title.includes("|")) {
              company = document.title.split("|")[1].trim();
            } else {
              company = "Empresa"; // Fallback if title format is unexpected
            }
          } catch (error) {
            console.warn("Could not extract company name from title:", error);
            company = "Empresa"; // Fallback
          }

          const pdfTitle = "Catálogo de Productos";

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
