export const TABS_ENABLED = true;
export const DEFAULT_TAB = "inventory";
export const TABS = {
  inventory: {
    label: "Inventario",
    handler: "loadInventory",
    cssClass: "",
    removeClasses: ["catalog-view"],
    enabled: true,
  },
  catalog: {
    label: "Catálogo",
    handler: "loadCatalog",
    cssClass: "catalog-view",
    removeClasses: [],
    enabled: true,
  },
  upload: {
    label: "Subida de archivos",
    handler: "loadUpload",
    cssClass: "upload-view",
    removeClasses: [],
    enabled: true,
  },
};
