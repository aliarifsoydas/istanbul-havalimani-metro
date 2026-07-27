// Statik sürümü worker.js'ten üretir.
//
// worker.js tek kaynaktır; bu betik onun ürettiği HTML'i Cloudflare Pages'in
// servis ettiği dosyalara yazar. Sayfa eklendiğinde LINES'a eklemek yeterli —
// burada ayrıca bir şey yapmaya gerek yok.
//
//   node build.mjs
//
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./worker.js";

// fileURLToPath şart: dizin adındaki boşluk/parantez URL.pathname'de %20 olur
// ve dosyalar yanlış klasöre yazılır.
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const ORIGIN = "https://istanbul-havalimani-metro.pages.dev";

// Worker yolu -> statik dosya yolu (Pages, /marmaray/ için marmaray/index.html servis eder)
const OUT = {
  "/": "index.html",
  "/marmaray": "marmaray/index.html",
  "/robots.txt": "robots.txt",
  "/sitemap.xml": "sitemap.xml",
};

let n = 0;
for (const [path, file] of Object.entries(OUT)) {
  const res = await worker.fetch(new Request(ORIGIN + path));
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  const body = await res.text();
  const target = ROOT + file;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);
  console.log(`  ${file.padEnd(20)} ${String(body.length).padStart(6)} bayt  ← ${path}`);
  n++;
}
console.log(`${n} dosya üretildi.`);
