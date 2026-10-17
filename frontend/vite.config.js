import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        // Sin changeOrigin: el backend ve el host del sitio (localhost:5173).
        // Si FastAPI redirige /api/x a /api/x/, la redirección queda en el
        // mismo origen y el navegador no descarta el token de sesión.
      },
    },
  },
});
