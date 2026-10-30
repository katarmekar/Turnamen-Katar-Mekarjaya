/**
 * Kompres gambar di browser sebelum upload (penting untuk kamera HP).
 * Non-image / HEIC / gagal canvas → kembalikan file asli.
 */

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_MAX_BYTES = 900_000;
const DEFAULT_QUALITY = 0.72;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function compressImageFile(
  file: File,
  opts?: {
    maxWidth?: number;
    maxBytes?: number;
    quality?: number;
  }
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // HEIC/HEIF sering tidak bisa di-canvas di browser
  if (/heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
    return file;
  }
  if (file.size <= (opts?.maxBytes ?? DEFAULT_MAX_BYTES) / 2) {
    // Sudah cukup kecil — tetap resize jika sangat lebar
    // lanjut proses agar dimensi terkendali
  }

  try {
    const maxWidth = opts?.maxWidth ?? DEFAULT_MAX_WIDTH;
    const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
    let quality = opts?.quality ?? DEFAULT_QUALITY;

    const img = await loadImage(file);
    const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const outType =
      file.type === "image/png" || file.type === "image/webp"
        ? "image/jpeg"
        : file.type.startsWith("image/")
          ? "image/jpeg"
          : "image/jpeg";

    let blob = await canvasToBlob(canvas, outType, quality);
    if (!blob) return file;

    // Turunkan quality bertahap jika masih terlalu besar
    while (blob.size > maxBytes && quality > 0.4) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, outType, quality);
      if (!blob) return file;
    }

    if (blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function compressUploadFile(file: File): Promise<File> {
  if (file.type.startsWith("image/")) {
    return compressImageFile(file);
  }
  return file;
}
