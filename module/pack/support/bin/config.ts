import type { OutputOptions, InputOptions } from 'rollup';

import { Env } from '@travetto/base';
import { ManifestModule, path, RootIndex } from '@travetto/manifest';

export type AssembleConfig = {
  dir: string;
  entryFile: string;
  modules: ManifestModule[];
};

export function getAssembleConfig(): { config: AssembleConfig, output: OutputOptions, input: InputOptions['input'], files: string[] } {
  const modules = [...RootIndex.getModuleList('all')]
    .map(x => RootIndex.manifest.modules[x])
    .filter(m => m.profiles.includes('std'));

  const intro = `
globalThis.crypto = require("crypto");

function __importStar(mod) { 
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
  result["default"] = mod;
  return result;
}`;

  const files = modules.flatMap(m => [
    ...m.files.$index ?? [],
    ...m.files.src ?? [],
    ...m.files.bin ?? [],
    ...(m.files.support ?? [])
      .filter(f => !/support\/(test|transform|doc|pack)/.test(f[0]))
  ]
    .filter(([, t]) => t === 'ts' || t === 'js' || t === 'json')
    .map(([f]) => path.resolve(m.output, f.replace(/[.]ts$/, '.js'))));

  const esm = Env.getBoolean('BUNDLE_ESM') ?? false;
  const format = esm ? 'esm' : 'commonjs';
  const sourcemap = Env.getBoolean('BUNDLE_SOURCEMAP') ?? false;
  const sources = Env.getBoolean('BUNDLE_SOURCES') ?? false;
  const compact = Env.getBoolean('BUNDLE_COMPRESS') ?? true;
  const dir = Env.get('BUNDLE_OUTPUT')!;
  const entryFile = Env.get('BUNDLE_ENTRY')!;

  const output: OutputOptions = { intro, format, sourcemap, sourcemapExcludeSources: !sources, compact, dir };

  return {
    files,
    output,
    config: { modules, entryFile, dir },
    input: [entryFile],
  };
}