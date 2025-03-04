import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [visualizer()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["jquery"],
          datatables: [
            "datatables.net-dt",
            "datatables.net-buttons",
            "datatables.net-buttons-dt",
          ],
          firebase: ["firebase/app", "firebase/auth"],
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
    include: ["jquery", "datatables.net-dt"],
  },
});
