import { createRequire } from 'node:module';
import path from 'node:path';
import type { NextConfig } from 'next';

// Hoisted workspace deps live in the root node_modules — resolve instead of guessing.
const require = createRequire(import.meta.url);
const wasm = path.join(
  path.dirname(require.resolve('node-sqlite3-wasm/package.json')),
  'dist',
  'node-sqlite3-wasm.wasm',
);

const nextConfig: NextConfig = {
  // Ships .next/standalone for the low-RAM store server (no build there).
  output: 'standalone',
  // The WASM binary is loaded from disk next to its JS: keep the package out of
  // the bundle so the path survives (and it ships node_modules for standalone).
  serverExternalPackages: ['node-sqlite3-wasm'],
  // …but the runtime loads the .wasm itself, so tracing must copy it too
  // (relative to this app dir — the config lives here and builds from here).
  outputFileTracingIncludes: {
    '/**': [path.relative(process.cwd(), wasm)],
  },
};

export default nextConfig;
