import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// pnpm 11 can omit native optional packages on Windows. Vite 6 and tsx use
// different esbuild versions, so Vite gets its matching binary explicitly.
const localRequire = createRequire(join(process.cwd(), "package.json"));

if (process.platform === "win32") {
  const binaryPackage = localRequire.resolve("esbuild-win32-v025/package.json");
  process.env.ESBUILD_BINARY_PATH = join(dirname(binaryPackage), "esbuild.exe");
}

const vitePackage = localRequire.resolve("vite/package.json");
const viteCli = join(dirname(vitePackage), "bin", "vite.js");
await import(pathToFileURL(viteCli).href);
