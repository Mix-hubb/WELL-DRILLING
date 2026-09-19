import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](vue|vue-router|pinia)[\\/]/.test(id)) {
            return "vendor-vue";
          }
          if (/[\\/]node_modules[\\/]vuetify[\\/]/.test(id)) {
            return "vendor-vuetify";
          }
        },
      },
    },
  },
  server: { port: 5173 },
  define: {
    // Vuetify reads process.env in a couple of internal spots during dev
    "process.env": {},
  },
});
