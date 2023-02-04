import type { OutputOptions, InputOptions } from 'rollup';
import type terser from '@rollup/plugin-terser';
import type commonjsRequire from '@rollup/plugin-commonjs';

import { Env } from '@travetto/base';
import { ManifestModule, path, RootIndex } from '@travetto/manifest';

import { PackFormat } from './types';

const INTRO = {
  commonjs: `
globalThis.crypto = require("crypto");
try { require('./.env')} catch {}

function __importStar(mod) { 
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
  result["default"] = mod;
  return result;
}
`,
  module: `
globalThis.crypto = await import("crypto");
try {await import('./.env')} catch {}
`
};

function getFilesFromModule(m: ManifestModule): string[] {
  return [
    ...m.files.$index ?? [],
    ...m.files.src ?? [],
    ...m.files.bin ?? [],
    ...(m.files.support ?? [])
      .filter(f => !/support\/(test|transform|doc|pack)/.test(f[0]))
  ]
    .filter(([, t]) => t === 'ts' || t === 'js' || t === 'json')
    .map(([f]) => path.resolve(m.output, f.replace(/[.]ts$/, '.js')));
}

export function getOutput(): OutputOptions {
  const sourcemap = Env.getBoolean('BUNDLE_SOURCEMAP') ?? false;
  const sources = Env.getBoolean('BUNDLE_SOURCES') ?? false;
  const compact = Env.getBoolean('BUNDLE_COMPRESS') ?? true;
  const format: PackFormat = Env.get('BUNDLE_FORMAT', 'commonjs');
  const dir = Env.get('BUNDLE_OUTPUT')!;
  return { intro: INTRO[format], format, sourcemap, sourcemapExcludeSources: !sources, compact, dir };
}

export function getInput(): InputOptions['input'] {
  return [Env.get('BUNDLE_ENTRY')!];
}

export function getCommonJsConfig(): Parameters<typeof commonjsRequire>[0] {
  const files = [...RootIndex.getModuleList('all')]
    .map(x => RootIndex.manifest.modules[x])
    .filter(m => m.profiles.includes('std'))
    .flatMap(getFilesFromModule);

  return {
    dynamicRequireRoot: RootIndex.manifest.workspacePath,
    dynamicRequireTargets: files
  };
}

export function getTerserConfig(): Parameters<typeof terser>[0] {
  return {
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
}
