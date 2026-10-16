/** Identifies an upload by its first bytes. The browser-supplied type and file name are not trusted. */
export function sniffMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
