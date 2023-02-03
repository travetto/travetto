// @ts-expect-error
import multipleInput from 'rollup-plugin-multi-input';
import commonjsRequire from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import jsonImport from '@rollup/plugin-json';

import sourceMaps from 'rollup-plugin-sourcemaps';
import type { RollupOptions } from 'rollup';

import { RootIndex } from '@travetto/manifest';

import { travettoPlugin } from './plugin';
import { getAssembleConfig } from './config';

const TERSER_CONFIG: Parameters<typeof terser>[0] = {
  mangle: true,
  keep_classnames: true,
  keep_fnames: true,
  ecma: 2020,
  compress: {},
  output: {
    shebang: false,
    comments: false,
  }
};

function buildConfig(): RollupOptions {
  const { config, input, output, files } = getAssembleConfig();

  return {
    input, output, plugins: [
      travettoPlugin(config),
      multipleInput(),
      jsonImport(),
      commonjsRequire({
        dynamicRequireRoot: RootIndex.manifest.workspacePath,
        dynamicRequireTargets: files
      }),
      nodeResolve({ preferBuiltins: true }),
      ...(output.sourcemap !== 'hidden' && output.sourcemap !== false ? [sourceMaps({})] : []),
      ...(output.compact ? [terser(TERSER_CONFIG)] : [])
    ]
  };
}

export default buildConfig();