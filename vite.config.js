import { defineConfig } from "vite";
export default defineConfig({
  build: { chunkSizeWarningLimit: 6000 },
  server: { host: "127.0.0.1" },
});
