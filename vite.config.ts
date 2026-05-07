import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Relative base so the built index.html works under file:// and the Electron
  // app:// custom protocol — both deliver assets without a host root.
  base: "./",
  server: {
    host: "::",
    port: 5173,
  },
  optimizeDeps: {
    entries: ["index.html"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Force assets to disk (no inline data: URIs) — easier to debug inside an
    // Electron bundle and avoids issues with very-large images blowing up CSS.
    assetsInlineLimit: 0,
  },
  define: {
    // Compile-time flag the runtime shim and feature gates can inspect.
    __DESKTOP_BUILD__: JSON.stringify(process.env.OPENQWNT_DESKTOP_BUILD === "true"),
  },
}));
