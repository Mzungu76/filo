// Copia in public/ocr i file di Tesseract (motore, worker, dati italiano) così l'OCR
// funziona dal nostro dominio, senza servizi esterni.
import { cpSync, mkdirSync } from "node:fs";

const out = "public/ocr";
mkdirSync(out, { recursive: true });
const core = "node_modules/tesseract.js-core";
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"]) {
  cpSync(`${core}/${f}`, `${out}/${f}`);
}
cpSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`);
cpSync("node_modules/@tesseract.js-data/ita/4.0.0_best_int/ita.traineddata.gz", `${out}/ita.traineddata.gz`);
