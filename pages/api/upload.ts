import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createReadStream } from "fs";

import { requireAdmin } from "../../lib/auth-helpers";
import { UPLOADS_URL_PREFIX, UPLOAD_EXTENSION_BY_MIME, getUploadsDir } from "../../lib/uploads";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizeMime(mime: string): string {
  if (mime === "image/jpg") return "image/jpeg";
  return mime;
}

const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP checked below
];

async function readFileHeader(filepath: string, length: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = createReadStream(filepath, { start: 0, end: length - 1 });
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function detectImageMime(filepath: string): Promise<string | null> {
  const header = await readFileHeader(filepath, 16);
  if (header.length < 3) return null;

  for (const signature of MAGIC_SIGNATURES) {
    if (signature.bytes.every((byte, index) => header[index] === byte)) {
      if (signature.mime === "image/webp") {
        // RIFF....WEBP
        if (header.length >= 12 && header.toString("ascii", 8, 12) === "WEBP") {
          return "image/webp";
        }
        continue;
      }
      return signature.mime;
    }
  }

  return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  let tempFilePath: string | null = null;

  try {
    const form = formidable({
      uploadDir: os.tmpdir(),
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      filter: function ({ mimetype }) {
        return Boolean(mimetype && ALLOWED_MIME_TYPES.has(mimetype));
      },
    });

    const [, files] = await form.parse(req);
    const file = Array.isArray(files.image) ? files.image[0] : files.image;

    if (!file) {
      return res.status(400).json({ success: false, error: "No image file provided" });
    }

    tempFilePath = file.filepath;

    const declaredMime = normalizeMime(file.mimetype || "");
    const detectedMime = await detectImageMime(file.filepath);

    if (!detectedMime) {
      return res.status(400).json({
        success: false,
        error: "File content does not match an allowed image type",
      });
    }

    // Prefer magic-byte detection; declared MIME must agree when present.
    if (declaredMime && declaredMime !== detectedMime) {
      return res.status(400).json({
        success: false,
        error: "File content does not match an allowed image type",
      });
    }

    const uploadsDir = getUploadsDir();
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `${randomUUID()}${UPLOAD_EXTENSION_BY_MIME[detectedMime]}`;
    // Copy (not rename): the temp dir may live on another filesystem.
    await fs.copyFile(file.filepath, path.join(uploadsDir, filename));

    return res.status(200).json({
      success: true,
      url: `${UPLOADS_URL_PREFIX}/${filename}`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to upload image",
    });
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => null);
    }
  }
}

export default requireAdmin(handler);
