import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: "127.0.0.1",
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          // Follow live storage redirects inside the dev proxy. Otherwise the
          // browser follows the R2 signed URL directly and hits R2 CORS.
          followRedirects: true,
          ws: true,
        },
        "/media": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          followRedirects: true,
        },
        "/ws": {
          target: apiTarget.replace(/^http/, "ws"),
          changeOrigin: true,
          secure: true,
          ws: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
  };
});
