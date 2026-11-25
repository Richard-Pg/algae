export const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/heic,image/heif,image/tiff,image/webp,.jpg,.jpeg,.png,.heic,.heif,.tif,.tiff,.webp";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const VALID_EXTENSIONS = ["jpg", "jpeg", "png", "heic", "heif", "tif", "tiff", "webp"];
const BROWSER_DECODABLE = ["image/jpeg", "image/png", "image/webp"];

export function validateImage(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!file.type.startsWith("image/") && !VALID_EXTENSIONS.includes(ext)) {
    return "That file type isn't supported. Use JPG, PNG, HEIC, TIFF or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "That file is larger than 20 MB.";
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export interface PreparedImage {
  file: File;
  /** Object URL for previewing, or null when this browser can't display the format (HEIC/TIFF in most browsers). */
  previewUrl: string | null;
}

/**
 * Downscale large JPEG/PNG/WebP files before upload to save bandwidth.
 * HEIC and TIFF are sent untouched: the server decodes them.
 */
export async function prepareImage(file: File, maxSide = 2048): Promise<PreparedImage> {
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    URL.revokeObjectURL(url);
    return { file, previewUrl: null };
  }

  if (!BROWSER_DECODABLE.includes(file.type) || Math.max(img.width, img.height) <= maxSide) {
    return { file, previewUrl: url };
  }

  const scale = maxSide / Math.max(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) return { file, previewUrl: url };

  URL.revokeObjectURL(url);
  const resized = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  return { file: resized, previewUrl: URL.createObjectURL(resized) };
}
