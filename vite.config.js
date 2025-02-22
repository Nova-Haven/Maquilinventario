import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/xlsx")) {
            return "xlsx";
          }
          if (id.includes("node_modules/datatables")) {
            return "datatables";
          }
          if (id.includes("node_modules/jquery")) {
            return "vendor";
          }
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }
        },
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  optimizeDeps: {
    include: ["xlsx", "jquery", "datatables.net-dt"],
  },
});
