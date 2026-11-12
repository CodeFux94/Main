// Rendert scripts/icon.svg als PNG-Icons (einmalig, Ergebnis wird committet).
// Aufruf: node scripts/make-icons.mjs (benötigt Playwright)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const svg = fs.readFileSync(path.join(__dirname, "icon.svg"), "utf8");
const out = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(out, { recursive: true });

const targets = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["apple-touch-icon.png", 180, 1],
  ["icon-maskable-512.png", 512, 0.8],
  ["favicon-32.png", 32, 1],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, scale] of targets) {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * scale);
    await page.setContent(
      `<html><body style="margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">` +
        `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
    );
    await page.screenshot({ path: path.join(out, name), omitBackground: false });
  }
  await browser.close();
  console.log("Icons erzeugt in public/icons");
})();
