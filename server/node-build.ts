import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createBaseServer } from "./index";
import * as express from "express";

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
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "media-src 'self' blob:",
        "connect-src 'self'",
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
                     process.argv[1]?.endsWith('node-build.ts');

if (isMainModule || process.env.RUN_SERVER === 'true') {
  const app = createServer();
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`🚀 Fusion Starter server running on port ${port}`);
    console.log(`📱 Frontend: http://localhost:${port}`);
    console.log(`🔧 API: http://localhost:${port}/api`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("🛑 Received SIGTERM, shutting down gracefully");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("🛑 Received SIGINT, shutting down gracefully");
    process.exit(0);
  });
}
