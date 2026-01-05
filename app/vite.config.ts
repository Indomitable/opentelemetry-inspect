import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [vue()],
  build: {
      rollupOptions: {
          output: {
              // nice file names with hashes for long-term caching
              entryFileNames: 'assets/[name].[hash].js',
              chunkFileNames: 'assets/[name].[hash].js',
              assetFileNames: 'assets/[name].[hash].[ext]',
              manualChunks(id) {
                  if (id.includes('primevue')) {
                      return 'primevue';
                  }
              }
          }
      }
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
