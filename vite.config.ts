import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /VKC/* is proxied to the API so the browser sees one origin (no CORS needed).
// Point VITE_API_PROXY at http://localhost:8000 to use a local API instead of the live one.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "./", // relative asset paths, so the build works from any folder on the web server
    plugins: [react()],
    server: {
      proxy: {
        "/VKC": {
          target: env.VITE_API_PROXY || "https://www.chuckbrandt.com",
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
