import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const host = process.env.HOST || "127.0.0.1";
const preferredPort = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function safePathname(urlPathname) {
  const pathname = decodeURIComponent(urlPathname.split("?")[0]);
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const targetPath = path.normalize(path.join(root, normalized));
  if (!targetPath.startsWith(root)) {
    return null;
  }
  return targetPath;
}

const server = http.createServer((request, response) => {
  const targetPath = safePathname(request.url || "/");
  if (!targetPath) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.stat(targetPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(response, 404, "Not found");
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    const type = mimeTypes[ext] || "application/octet-stream";
    const stream = fs.createReadStream(targetPath);
    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
    });
    stream.pipe(response);
    stream.on("error", () => {
      if (!response.headersSent) {
        send(response, 500, "Failed to read file");
      } else {
        response.destroy();
      }
    });
  });
});

function listen(port) {
  server.listen(port, host, () => {
    console.log(`Wavythought Generator dev server running at http://${host}:${port}/`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = Number(server.address()?.port || preferredPort) + 1;
    listen(nextPort);
    return;
  }
  throw error;
});

listen(preferredPort);
