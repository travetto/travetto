import type { OutputOptions } from 'rollup';
import type terser from '@rollup/plugin-terser';

import { Env } from '@travetto/base';
import { ManifestModule, ManifestModuleUtil, Package, path, RootIndex } from '@travetto/manifest';

const INTRO = {
  commonjs: `
globalThis.crypto = require('crypto');
try { require('./.env.js')} catch {}

function __importStar(mod) { 
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
  result['default'] = mod;
  return result;
}
`,
  module: `
globalThis.crypto = await import('crypto');
try {await import('./.env.js')} catch {}
`
};

function getFilesFromModule(m: ManifestModule): string[] {
  return [
    ...m.files.$index ?? [],
    ...m.files.src ?? [],
    ...m.files.bin ?? [],
    ...(m.files.support ?? [])
      .filter(f => !/support\/(test|doc)/.test(f[0]))
  ]
    .filter(([, t]) => t === 'ts' || t === 'js' || t === 'json')
    .map(([f]) => ManifestModuleUtil.sourceToOutputExt(path.resolve(m.outputFolder, f)));
}

export function getOutput(): OutputOptions {
  const format: Package['type'] = Env.get('BUNDLE_FORMAT', 'commonjs');
  const dir = Env.get('BUNDLE_OUTPUT')!;
  const mainFile = Env.get('BUNDLE_MAIN_FILE')!;
  return {
    format,
    intro: INTRO[format],
    sourcemapPathTransform: (src, map): string =>
      path.resolve(path.dirname(map), src).replace(`${RootIndex.manifest.workspacePath}/`, ''),
    sourcemap:
      Env.getBoolean('BUNDLE_SOURCEMAP') ?? false,
    sourcemapExcludeSources:
      !(Env.getBoolean('BUNDLE_SOURCES') ?? false),
    compact:
      Env.getBoolean('BUNDLE_COMPRESS') ?? true,
    file: path.resolve(dir, mainFile),
    ...(format === 'commonjs' ? {} : {
      inlineDynamicImports: true
    }),
  };
}

export function getEntry(): string {
  return Env.get('BUNDLE_ENTRY')!;
}

export function getFiles(): string[] {
  return [...RootIndex.getModuleList('all')]
    .map(x => RootIndex.manifest.modules[x])
    .filter(m => m.profiles.includes('std'))
    .flatMap(getFilesFromModule);
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
