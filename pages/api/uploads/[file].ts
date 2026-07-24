import { NextApiRequest, NextApiResponse } from "next";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";

import { UPLOAD_MIME_BY_EXTENSION, resolveUploadPath } from "../../../lib/uploads";

export const config = {
  api: {
    responseLimit: false,
  },
};

// Serves /uploads/<filename> (see the rewrite in next.config.ts). Next only
// indexes public/ at startup, so images uploaded after boot need this route.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requested = Array.isArray(req.query.file) ? req.query.file[0] : req.query.file;
  const filepath = requested ? resolveUploadPath(requested) : null;

  if (!filepath) {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const stats = await fs.stat(filepath);
    if (!stats.isFile()) {
      return res.status(404).json({ error: "Not found" });
    }

    res.setHeader("Content-Type", UPLOAD_MIME_BY_EXTENSION[path.extname(filepath).toLowerCase()]);
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filepath);
      stream.on("error", reject);
      stream.on("end", resolve);
      stream.pipe(res);
    });
  } catch {
    if (!res.headersSent) {
      return res.status(404).json({ error: "Not found" });
    }
    res.end();
  }
}
