import commonjsRequire from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import jsonImport from '@rollup/plugin-json';
import sourceMaps from 'rollup-plugin-sourcemaps';
import type { RollupOptions } from 'rollup';

import { getInput, getOutput, getTerserConfig, getCommonJsConfig } from './config';

export default function buildConfig(): RollupOptions {
  const output = getOutput();
  return {
    input: getInput(),
    output,
    plugins: [
      jsonImport(),
      commonjsRequire({
        ...getCommonJsConfig(),
      }),
      nodeResolve({ preferBuiltins: true }),
      ...(output.sourcemap !== 'hidden' && output.sourcemap !== false ? [sourceMaps({})] : []),
      ...(output.compact ? [terser(getTerserConfig())] : [])
    ]
  };
}