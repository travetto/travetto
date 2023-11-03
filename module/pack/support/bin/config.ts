import type { OutputOptions } from 'rollup';
import { __importStar } from 'tslib';

import type terser from '@rollup/plugin-terser';

import { Env } from '@travetto/base';
import { ManifestModule, ManifestModuleUtil, Package, path, RootIndex } from '@travetto/manifest';

const makeIntro = (doImport: (name: string) => string, ...extra: string[]): string => [
  `try { globalThis.crypto = ${doImport('crypto')}; } catch {}`,
  `try { ${doImport('./.env.js')} } catch {}`,
  ...extra
].map(x => x.trim()).join('\n');

const INTRO = {
  commonjs: makeIntro(
    v => `require('${v}')`,
    __importStar.toString().replace(/function([^(]+)/, 'function __importStar'),
  ),
  module: makeIntro(v => `await import('${v}')`)
};

function getFilesFromModule(m: ManifestModule): string[] {
  return [
    ...m.files.$index ?? [],
    ...m.files.src ?? [],
    ...(m.files.bin ?? [])
      .filter(f => !(/bin\/trv[.]js$/.test(f[0]) && m.name === '@travetto/cli')),
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
    .filter(m => m.prod)
    .flatMap(getFilesFromModule);
}

export function getIgnoredModules(): string[] {
  const out = [...RootIndex.getModuleList('all')]
    .map(x => RootIndex.manifest.modules[x])
    .filter(m => !m.prod)
    .map(m => m.name);

  out.push('@travetto/pack', '@travetto/compiler');

  return out;
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
