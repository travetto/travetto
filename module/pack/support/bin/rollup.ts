import commonjsRequire from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import jsonImport from '@rollup/plugin-json';
import sourceMaps from 'rollup-plugin-sourcemaps';
import type { RollupOptions } from 'rollup';

import { RootIndex } from '@travetto/manifest';

import { getInput, getOutput, getTerserConfig, getFiles } from './config';
import { travettoImportPlugin } from './rollup-esm-dynamic-import';

export default function buildConfig(): RollupOptions {
  const output = getOutput();
  const files = getFiles();
  return {
    input: getInput(),
    output,
    plugins: [
      jsonImport(),
      commonjsRequire({
        dynamicRequireRoot: RootIndex.manifest.workspacePath,
        dynamicRequireTargets: (output.format === 'commonjs' ? files : [])
      }),
      ...(output.format === 'module' ? [travettoImportPlugin(files)] : []),
      nodeResolve({ preferBuiltins: true }),
      ...(output.sourcemap !== 'hidden' && output.sourcemap !== false ? [sourceMaps({})] : []),
      ...(output.compact ? [terser(getTerserConfig())] : [])
    ]
  };
}