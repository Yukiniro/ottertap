import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  agentRules: false,
  turbopack: {
    root: fileURLToPath(new URL('..', import.meta.url)),
    resolveAlias: { '#i18n': './lib/ext-i18n.ts' }
  }
};

export default config;
