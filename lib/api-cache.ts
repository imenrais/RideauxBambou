import type { NextApiResponse } from "next";

export const setPublicCacheHeaders = (res: NextApiResponse, maxAgeSeconds = 60) => {
  res.setHeader("Cache-Control", `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=300`);
};
