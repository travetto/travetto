import commonjsRequire from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import jsonImport from '@rollup/plugin-json';
import type { RollupOptions } from 'rollup';

import { getCoreConfig } from './config';
import { travettoImportPlugin } from './rollup-travetto-import';
import { travettoSourcemaps } from './rollup-travetto-sourcemaps';
import { travettoEntryPlugin } from './rollup-travetto-entry';

export default function buildConfig(): RollupOptions {
  // Load up if not defined
  const config = getCoreConfig();

  return {
    input: [config.entry],
    output: config.output,
    external: config.external,
    plugins: [
      jsonImport(),
      travettoEntryPlugin(config),
      travettoImportPlugin(config),
      commonjsRequire({ ignore: id => config.ignore.has(id) }),
      nodeResolve({ preferBuiltins: true }),
      travettoSourcemaps(config),
      ...(config.output.compact ? [terser(config.minify)] : [])
    ]
  };
}