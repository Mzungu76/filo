// Genera le icone di Filo da un'unica forma (richiede playwright).
// Uso: node scripts/make-icons.js [anteprima.png]
// Disegno: un sottilissimo filo che si intreccia in anelli a formare il cerchio del timer; al centro la spunta.
const { chromium } = require("playwright");
const fs = require("fs");

const R = "android/app/src/main/res";
const RING = { r: 152, loops: 23, amp: 15 };

/** Filo che disegna il cerchio con tanti piccoli anelli intrecciati (epitrocoide), centrato in (256,256). */
function threadPath(samples = 640) {
  const rot = -Math.PI / 2;
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const x = 256 + RING.r * Math.cos(t + rot) + RING.amp * Math.cos(RING.loops * t + rot);
    const y = 256 + RING.r * Math.sin(t + rot) + RING.amp * Math.sin(RING.loops * t + rot);
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
const THREAD = threadPath();
const CHECK = "M192 264L240 310L330 210";

const DEFS = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#21495f"/><stop offset="1" stop-color="#0d1f2d"/></linearGradient>
  <linearGradient id="th" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6fbf1"/><stop offset="1" stop-color="#8fe3c0"/></linearGradient>
  <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd978"/><stop offset="1" stop-color="#f2a93b"/></linearGradient>
</defs>`;
const art = (scale = 1, strokeW = 5) => `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
  <circle cx="256" cy="256" r="${RING.r}" fill="none" stroke="#a8ecd0" stroke-opacity=".10" stroke-width="${RING.amp * 2 + 14}"/>
  <path d="${THREAD}" fill="none" stroke="url(#th)" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${CHECK}" fill="none" stroke="url(#amber)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${DEFS}${inner}</svg>`;

const rounded = svg(`<rect width="512" height="512" rx="138" fill="url(#bg)"/>${art()}`);
const square = svg(`<rect width="512" height="512" fill="url(#bg)"/>${art()}`);
const round = svg(`<circle cx="256" cy="256" r="256" fill="url(#bg)"/>${art(0.92)}`);
const foreground = svg(art(0.88, 5.5));

fs.writeFileSync("public/icon.svg", rounded.replace(' width="100%" height="100%"', ""));
// Percorso del filo condiviso con il marchio dentro l'app.
fs.writeFileSync("src/lib/brandPath.ts", `// Generato da scripts/make-icons.js: non modificare a mano.\nexport const THREAD_PATH = "${THREAD}";\nexport const CHECK_PATH = "${CHECK}";\n`);

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
