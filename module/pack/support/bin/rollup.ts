import commonjsRequire from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import jsonImport from '@rollup/plugin-json';
import type { RollupOptions } from 'rollup';

import { RuntimeManifest } from '@travetto/manifest';

import { getEntry, getOutput, getTerserConfig, getFiles, getIgnoredModules } from './config';
import { travettoImportPlugin } from './rollup-esm-dynamic-import';
import { sourcemaps } from './rollup-sourcemaps';

const NEVER_INCLUDE = new Set<string>([]);

export default function buildConfig(): RollupOptions {
  const output = getOutput();
  const entry = getEntry();
  const files = getFiles();
  const ignore = getIgnoredModules();
  const ignoreRe = new RegExp(`^(${ignore.join('|')})`);

  return {
    input: [entry],
    output,
    plugins: [
      jsonImport(),
      commonjsRequire({
        ignore: id => ignoreRe.test(id) || NEVER_INCLUDE.has(id),
        dynamicRequireRoot: RuntimeManifest.workspacePath,
        dynamicRequireTargets: (output.format === 'commonjs' ? files : [])
      }),
      ...(output.format === 'module' ? [travettoImportPlugin(entry, files)] : []),
      nodeResolve({ preferBuiltins: true }),
      ...(output.sourcemap !== 'hidden' && output.sourcemap !== false ? [sourcemaps()] : []),
      ...(output.compact ? [terser(getTerserConfig())] : [])
    ]
  };
}