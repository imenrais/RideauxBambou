import path from "path";

export const UPLOADS_URL_PREFIX = "/uploads";

export const UPLOAD_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const UPLOAD_MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Uploaded images live on the VPS disk. UPLOAD_DIR lets production point at a
// persistent folder outside the build output so rebuilds never wipe images.
export function getUploadsDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  // The standalone server runs from .next/standalone, which `next build`
  // regenerates — resolve back to the project's own public/uploads instead.
  const cwd = process.cwd();
  const root = cwd.endsWith(path.join(".next", "standalone")) ? path.resolve(cwd, "..", "..") : cwd;
  return path.join(root, "public", "uploads");
}

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

/** Accept only local upload paths produced by /api/upload (no remote URLs). */
export function isValidUploadImageUrl(value: string): boolean {
  if (!value.startsWith(`${UPLOADS_URL_PREFIX}/`)) return false;
  const filename = value.slice(UPLOADS_URL_PREFIX.length + 1);
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return false;
  }
  return resolveUploadPath(filename) !== null;
}

// Returns the absolute path of an uploaded file, or null when the requested
// name is not a plain safe filename inside the uploads directory.
export function resolveUploadPath(filename: string): string | null {
  if (!SAFE_FILENAME.test(filename)) return null;

  const extension = path.extname(filename).toLowerCase();
  if (!UPLOAD_MIME_BY_EXTENSION[extension]) return null;

  const uploadsDir = getUploadsDir();
  const resolved = path.resolve(uploadsDir, filename);
  if (path.dirname(resolved) !== path.resolve(uploadsDir)) return null;

  return resolved;
}
