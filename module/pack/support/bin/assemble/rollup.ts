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

function buildConfig(): RollupOptions {
  const config = getAssembleConfig();

  const options: RollupOptions = {
    // use glob in the input
    input: [config.entryFile],
    output: {
      intro: [
        'globalThis.crypto = require("crypto");',
        'function __importStar(obj) { return require("tslib").__importStar(obj); }'
      ].join('\n'),
      format: config.esm ? 'esm' : 'commonjs',
      sourcemap: config.sourcemaps,
      sourcemapExcludeSources: !config.sources,
      compact: config.compress,
      dir: config.output
    },
    plugins: [
      travettoPlugin(config),
      multipleInput(),
      jsonImport(),
      commonjsRequire({
        dynamicRequireRoot: RootIndex.manifest.workspacePath,
        dynamicRequireTargets: config.input,
      }),
      config.sourcemaps ? sourceMaps({}) : undefined,
      config.compress ? terser({
        mangle: true,
        keep_classnames: true,
        keep_fnames: true,
        ecma: 2020,
        compress: {},
        output: {
          shebang: false,
          comments: false,
        }
      }) : null,
      nodeResolve({ preferBuiltins: true }),
    ].filter(x => !!x),
  };

  return options;
}

export default buildConfig();