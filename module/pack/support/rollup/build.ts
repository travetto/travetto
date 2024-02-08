import commonjsRequire from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import jsonImport from '@rollup/plugin-json';
import type { RollupOptions } from 'rollup';

import { EnvProp } from '@travetto/base';
import { RuntimeContext } from '@travetto/manifest';

import { getEntry, getOutput, getTerserConfig, getFiles, getIgnoredModules } from './config';
import { travettoImportPlugin } from './rollup-travetto-import';
import { sourcemaps } from './rollup-sourcemaps';
import { travettoEntryPlugin } from './rollup-travetto-entry';

export default function buildConfig(): RollupOptions {
  const output = getOutput();
  const entry = getEntry();
  const files = getFiles(entry);
  const ignore = getIgnoredModules();
  const ignoreRe = new RegExp(`^(${ignore.join('|')})`);

  return {
    input: [entry],
    output,
    plugins: [
      jsonImport(),
      travettoEntryPlugin(entry, new EnvProp('BUNDLE_ENV_FILE').val, files),
      travettoImportPlugin(files, ignore),
      commonjsRequire({
        ignore: id => ignoreRe.test(id),
        dynamicRequireRoot: RuntimeContext.workspace.path,
        dynamicRequireTargets: []
      }),
      nodeResolve({ preferBuiltins: true }),
      ...(output.sourcemap !== 'hidden' && output.sourcemap !== false ? [sourcemaps()] : []),
      ...(output.compact ? [terser(getTerserConfig())] : [])
    ]
  };
}