const TARGET_WIDTH = 1440;

/** Porta lo screenshot a una larghezza standard e in scala di grigi: la lettura è molto più stabile. */
async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = TARGET_WIDTH / bitmap.width;
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.filter = "grayscale(1)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/png"));
}

/** Legge il testo di un'immagine sul dispositivo. Motore e dati italiano sono serviti da /ocr. */
export async function readImageText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ita", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    }
  });
  try {
    const { data } = await worker.recognize(await prepare(file));
    return data.text;
  } finally {
    await worker.terminate();
  }
}
