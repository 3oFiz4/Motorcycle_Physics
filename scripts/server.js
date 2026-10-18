//serve http files locally
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root_dir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || "0.0.0.0";
const mime_types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  //see and catch any server error
  try {
    const raw_url = (req.url || "/").split("?")[0];
    const safe_suffix = path
      .normalize(decodeURIComponent(raw_url))
      .replace(/^(\.\.(\/|\\|$))+/, "");
    let tgt_path = path.join(
      root_dir,
      safe_suffix === "/" || safe_suffix === "" ? "index.html" : safe_suffix,
    );

    if (safe_suffix.replace(/\\/g, "/") === "/src/vendor/three.module.js") {
      const npm_path = path.join(
        root_dir,
        "node_modules",
        "three",
        "build",
        "three.module.js",
      );
      if (fs.existsSync(npm_path)) tgt_path = npm_path;
    }

    //block illegal path traversal!
    if (!tgt_path.startsWith(root_dir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("403 Forbidden");
      return;
    }

    if (fs.existsSync(tgt_path) && fs.statSync(tgt_path).isDirectory()) {
      tgt_path = path.join(tgt_path, "index.html");
    }

    //file exist check?
    if (!fs.existsSync(tgt_path)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`404 Not Found: ${raw_url}`);
      return;
    }

    const ext = path.extname(tgt_path).toLowerCase();
    const content_type = mime_types[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": content_type,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(tgt_path).pipe(res);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`500 Internal Server Error: ${err.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`check on localhost:${port}`);
});
