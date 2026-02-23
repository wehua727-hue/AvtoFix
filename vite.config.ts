import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  server: {
    host: "0.0.0.0", // VPS da barcha interfacelar uchun
    port: 5174, // Frontend uchun boshqa port (backend 5173 da ishlaydi)
    strictPort: false,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "shop.avtofix.uz",
      "avtofix.uz",
      ".avtofix.uz", // Barcha subdomenlar
      ".wpshost.ru", // WPS hosting
      ".hosting", // Boshqa hosting provayderlar
    ],
    fs: {
      allow: ["./", "./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5175",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:5175",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false, // Production uchun sourcemap o'chirish
    minify: 'esbuild', // esbuild ishlatish (tezroq va dependency kerak emas)
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
