// Copia in public/ocr i file di Tesseract (motore, worker, dati italiano) così l'OCR
// funziona dal nostro dominio, senza servizi esterni.
import { cpSync, mkdirSync } from "node:fs";

// L'app Android legge gli screenshot con il riconoscimento del sistema (ML Kit): niente motore OCR nell'APK (-10 MB).
if (process.env.BUILD_TARGET === "android") process.exit(0);

const out = "public/ocr";
mkdirSync(out, { recursive: true });
const core = "node_modules/tesseract.js-core";
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"]) {
  cpSync(`${core}/${f}`, `${out}/${f}`);
}
cpSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`);
cpSync("node_modules/@tesseract.js-data/ita/4.0.0_best_int/ita.traineddata.gz", `${out}/ita.traineddata.gz`);
