import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Store, atomicWrite } from "./store.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [file, sessionDir] = process.argv.slice(2);
const token = crypto.randomBytes(32).toString("hex");
const store = new Store(file, path.join(sessionDir, "history"));
const clients = new Map(),
  jobs = new Map();
const boot = crypto.randomUUID();
let origin;
function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
function broadcast(data) {
  for (const res of clients.values())
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
async function body(req) {
  let size = 0,
    chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 40 * 1024 * 1024)
      throw Object.assign(new Error("Scene exceeds 40 MB."), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (
      req.headers.host !== new URL(origin).host ||
      (req.headers.origin && req.headers.origin !== origin)
    )
      return send(res, 403, { error: "Invalid origin" });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (url.pathname.startsWith("/api/")) {
      if (
        req.headers.authorization !== `Bearer ${token}` &&
        !(
          url.pathname === "/api/events" &&
          url.searchParams.get("token") === token
        )
      )
        return send(res, 401, { error: "Unauthorized" });
      if (req.method === "GET" && url.pathname === "/api/state")
        return send(res, 200, {
          ...store.state(),
          boot,
          clients: clients.size,
        });
      if (req.method === "GET" && url.pathname === "/api/events") {
        const id = url.searchParams.get("client");
        if (!id) return send(res, 400, { error: "Missing client" });
        clients.get(id)?.end();
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
        });
        clients.set(id, res);
        res.write(
          `data: ${JSON.stringify({ type: "state", ...store.state(), boot })}\n\n`,
        );
        const ping = setInterval(() => res.write(": heartbeat\n\n"), 10000);
        req.on("close", () => {
          clearInterval(ping);
          if (clients.get(id) === res) clients.delete(id);
        });
        return;
      }
      if (req.method !== "POST") return send(res, 404, { error: "Not found" });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "JSON required" });
      const data = await body(req);
      if (url.pathname === "/api/save") {
        const state = store.commit(data.scene, data.baseRevision);
        broadcast({ type: "state", ...state, client: data.client });
        return send(res, 200, state);
      }
      if (url.pathname === "/api/reload") {
        const state = store.load();
        broadcast({ type: "state", ...state });
        return send(res, 200, state);
      }
      if (url.pathname === "/api/command") {
        if (!clients.size)
          return send(res, 409, {
            error:
              "Open the returned canvas URL in the Codex right-side browser panel before drawing.",
            code: "PANEL_REQUIRED",
          });
        const id = data.id || crypto.randomUUID();
        if (jobs.has(id))
          return send(res, 409, {
            error:
              "Command ID already submitted; read the scene before retrying.",
          });
        const client = clients.keys().next().value;
        const timer = setTimeout(() => {
          jobs.delete(id);
          send(res, 504, {
            error:
              "The canvas did not respond within 30 seconds. Check the panel connection and read the scene before retrying.",
          });
        }, 30000);
        jobs.set(id, { res, timer, client });
        clients
          .get(client)
          .write(
            `data: ${JSON.stringify({ type: "command", id, command: data.command, expectedRevision: data.expectedRevision })}\n\n`,
          );
        return;
      }
      if (url.pathname === "/api/result") {
        const job = jobs.get(data.id);
        if (!job) return send(res, 410, { error: "Command expired" });
        if (job.client !== data.client)
          return send(res, 403, { error: "Wrong client" });
        clearTimeout(job.timer);
        jobs.delete(data.id);
        send(
          job.res,
          data.error ? 422 : 200,
          data.error
            ? { error: data.error }
            : { ...data.result, revision: store.revision },
        );
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "Not found" });
    }
    if (req.method !== "GET")
      return send(res, 405, { error: "Method not allowed" });
    const dist = path.join(root, "dist");
    let target = path.resolve(
      dist,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!target.startsWith(dist + path.sep))
      return send(res, 403, { error: "Invalid path" });
    if (!fs.existsSync(target) || !fs.statSync(target).isFile())
      return send(res, 404, { error: "Not found" });
    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".woff2": "font/woff2",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".json": "application/json",
    };
    res.writeHead(200, {
      "Content-Type": mime[path.extname(target)] || "application/octet-stream",
      "Cache-Control": target.endsWith(".html")
        ? "no-store"
        : "public,max-age=86400",
    });
    fs.createReadStream(target).pipe(res);
  } catch (e) {
    send(res, e.status || 400, { error: e.message });
  }
});
server.listen(0, "127.0.0.1", () => {
  origin = `http://127.0.0.1:${server.address().port}`;
  atomicWrite(
    path.join(sessionDir, "session.json"),
    JSON.stringify({ pid: process.pid, origin, token, file, boot, root }),
  );
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    for (const res of clients.values()) res.end();
    server.close(() => process.exit(0));
  });
