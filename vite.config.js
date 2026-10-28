import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

function listPublic(root) {
  const dir = path.join(root, "public");
  const out = [];
  const walk = (current, prefix) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
      else out.push(`./${rel}`);
    }
  };
  walk(dir, "");
  return out;
}

function swSource(cacheName, files) {
  return `const CACHE = ${JSON.stringify(cacheName)};
const SHELL = ${JSON.stringify(files)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh.ok && fresh.type === "basic") cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = (await caches.match(req)) || (req.mode === "navigate" ? await caches.match("./index.html") : null);
        return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })(),
  );
});
`;
}

function fotoServiceWorker() {
  return {
    name: "foto-sw",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = new Set(["./", "./index.html", ...listPublic(process.cwd())]);
      for (const item of Object.values(bundle)) {
        const name = item.fileName || item.name;
        if (!name || name === "sw.js") continue;
        files.add(`./${name}`);
      }
      const list = [...files].sort();
      let hash = 2166136261;
      const joined = list.join("|");
      for (let i = 0; i < joined.length; i += 1) {
        hash ^= joined.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: swSource(`foto-${(hash >>> 0).toString(16)}`, list),
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [fotoServiceWorker()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
