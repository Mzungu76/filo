// Genera le icone di Filo da un'unica forma (richiede playwright: `npx playwright` o node_modules globali).
// Uso: node scripts/make-icons.js
const { chromium } = require("playwright");
const fs = require("fs");

const R = "android/app/src/main/res";
const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#21495f"/><stop offset="1" stop-color="#0d1f2d"/></linearGradient>
  <linearGradient id="th" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7fd8b3"/><stop offset="1" stop-color="#dcf8ea"/></linearGradient>
</defs>`;
// Un filo che entra dal basso a sinistra, si avvolge in un cerchio (il timer) e finisce con la cruna dell'ago.
const thread = (scale = 1) => `<g transform="translate(256 256) scale(${scale}) translate(-222 -254)">
  <path d="M70 380C112 442 190 344 256 344A118 118 0 1 0 138 226" fill="none" stroke="url(#th)" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="138" cy="226" r="23" fill="#ffc857"/>
</g>`;
const svg = (inner, vb = "0 0 512 512") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%">${DEFS}${inner}</svg>`;

const rounded = svg(`<rect width="512" height="512" rx="138" fill="url(#bg)"/>${thread()}`);
const square = svg(`<rect width="512" height="512" fill="url(#bg)"/>${thread()}`);
const round = svg(`<circle cx="256" cy="256" r="256" fill="url(#bg)"/>${thread(0.92)}`);
const foreground = svg(thread(0.86));

fs.writeFileSync("public/icon.svg", rounded.replace(' width="100%" height="100%"', ""));

const dens = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const shot = async (markup, size, path) => {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;background:transparent">${markup}</body>`);
    await p.screenshot({ path, omitBackground: true });
  };
  for (const [d, [legacy, adaptive]] of Object.entries(dens)) {
    await shot(rounded, legacy, `${R}/mipmap-${d}/ic_launcher.png`);
    await shot(round, legacy, `${R}/mipmap-${d}/ic_launcher_round.png`);
    await shot(foreground, adaptive, `${R}/mipmap-${d}/ic_launcher_foreground.png`);
  }
  await shot(square, 180, "public/icon-180.png"); // iOS arrotonda da solo
  await shot(rounded, 192, "public/icon-192.png");
  await shot(rounded, 512, "public/icon-512.png");
  await shot(rounded, 1024, process.argv[2] || "/tmp/icon-preview.png");
  await b.close();
})();
