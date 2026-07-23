import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDir, "public");

if (!existsSync(standaloneDir)) {
  console.error("Missing .next/standalone — run `next build` with output: 'standalone' first.");
  process.exit(1);
}

mkdirSync(path.join(standaloneDir, ".next"), { recursive: true });

if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true });
  console.log("Copied .next/static → .next/standalone/.next/static");
}

if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log("Copied public → .next/standalone/public");
}

// Make env available to the standalone server (cwd = .next/standalone).
for (const envFile of [".env", ".env.production", ".env.local"]) {
  const src = path.join(root, envFile);
  if (existsSync(src)) {
    cpSync(src, path.join(standaloneDir, envFile));
    console.log(`Copied ${envFile} → .next/standalone/${envFile}`);
  }
}

console.log("Standalone bundle is ready for Hostinger / PM2.");
