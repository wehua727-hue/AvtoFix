import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createBaseServer } from "./index";
import * as express from "express";
import { createServer as createHTTPServer } from "http";
import { wsManager } from "./websocket";

// Export createServer function for Electron
export function createServer() {
  const app = createBaseServer();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.join(__dirname, "..");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Dist directory not found at ${distPath}`);
  }

  // Serve static files
  app.use(express.static(distPath));

  // Set strong Content Security Policy for packaged app
  app.use((_, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "media-src 'self' blob:",
        "connect-src 'self' wss://shop.avtofix.uz https://shop.avtofix.uz https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com ws://localhost:8182",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
    next();
  });

  // Handle React Router - serve index.html for all non-API routes
  app.use((req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  return app;
}

// If running directly (not imported), start the server
// Check if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || 
                     process.argv[1]?.endsWith('node-build.mjs') ||
                     process.argv[1]?.endsWith('node-build.ts') ||
                     import.meta.url.includes('node-build');

// Always start server in development mode when run via tsx
if (isMainModule || process.env.RUN_SERVER === 'true' || process.env.NODE_ENV !== 'production') {
  const app = createServer();
  
  // Port handling with proper fallback
  let port = 5175; // Default API port to match client proxy (5175)
  
  // Try to get port from environment variables
  if (process.env.PORT) {
    port = Number(process.env.PORT);
  } else if (process.env.API_PORT) {
    port = Number(process.env.API_PORT);
  }
  
  // Validate port number
  if (isNaN(port) || port < 1 || port > 65535) {
    console.warn(`⚠️  Invalid port: ${process.env.PORT || process.env.API_PORT}, using default 5173`);
    port = 5173;
  }
  
  console.log(`🔧 Environment PORT: ${process.env.PORT}`);
  console.log(`🔧 Environment API_PORT: ${process.env.API_PORT}`);
  console.log(`🔧 Using port: ${port}`);

  // Create HTTP server and attach WebSocket
  const httpServer = createHTTPServer(app);
  wsManager.initialize(httpServer);

  httpServer.listen(port, () => {
    console.log(`🚀 Fusion Starter server running on port ${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
    console.log(`🔌 WebSocket: ws://localhost:${port}/ws`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("🛑 Received SIGTERM, shutting down gracefully");
    wsManager.shutdown();
    httpServer.close(() => {
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("🛑 Received SIGINT, shutting down gracefully");
    wsManager.shutdown();
    httpServer.close(() => {
      process.exit(0);
    });
  });
}
