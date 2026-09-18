import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const host = "127.0.0.1";
const port = Number(process.env.STAYCLEAN_PORT || 4173);
let quoteRequests = 0;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65536) reject(new Error("Request too large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function publicPath(pathname) {
  if (pathname === "/") return join(root, "index.html");
  if (["/index.html", "/styles.css", "/script.js"].includes(pathname)) {
    return join(root, pathname.slice(1));
  }
  if (pathname.startsWith("/assets/")) {
    const relative = normalize(pathname.slice(1));
    if (!relative.startsWith("assets/")) return null;
    return join(root, relative);
  }
  return null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  if (request.method === "POST" && url.pathname === "/api/quote") {
    quoteRequests += 1;
    try {
      JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { ok: false, message: "Invalid preview request." });
      return;
    }

    const mode = url.searchParams.get("mode") || "success";
    if (mode === "hold") await new Promise((resolve) => setTimeout(resolve, 900));
    if (mode === "failure") {
      json(response, 503, { ok: false, message: "Preview failure." });
      return;
    }

    if (mode === "production") {
      json(response, 200, { ok: true, message: "Local production-response simulation complete." });
      return;
    }

    json(response, 200, { ok: true, preview: true, message: "Preview complete. Nothing was sent." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/__qa__/stats") {
    json(response, 200, { quoteRequests });
    return;
  }

  if (request.method === "POST" && url.pathname === "/__qa__/reset") {
    quoteRequests = 0;
    json(response, 200, { ok: true });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    json(response, 405, { ok: false });
    return;
  }

  const target = publicPath(url.pathname);
  if (!target) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(target)] || "application/octet-stream",
      "Cache-Control": url.pathname.startsWith("/assets/") ? "public, max-age=3600" : "no-cache"
    });
    if (request.method === "HEAD") response.end();
    else response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Stayclean local preview: http://${host}:${port}/`);
});
