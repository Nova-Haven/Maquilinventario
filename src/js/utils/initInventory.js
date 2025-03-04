import $ from "jquery";
import languageES from "datatables.net-plugins/i18n/es-ES.mjs";
import pdfMake from "pdfmake/build/pdfmake";
import Swal from "sweetalert2";

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
                        // Extract code and description from note text
                        const match = note.match(/^\((\d+)\)\s*(.*)/);
                        if (match) {
                          return [
                            { text: match[1], alignment: "center", bold: true },
                            { text: match[2].trim() },
                          ];
                        }
                        return [{ text: "", alignment: "center" }, note];
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
    dom: '<"datatable-header"<"left"l><"center"B><"right"f>>rt<"datatable-footer"<"pagination-wrapper"<"pagination-info"i><"pagination-controls"p>>>',
    scrollX: false,
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
