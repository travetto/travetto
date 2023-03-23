import type { OutputOptions } from 'rollup';
import { __importStar } from 'tslib';

import type terser from '@rollup/plugin-terser';

import { Env } from '@travetto/base';
import { ManifestModule, ManifestModuleUtil, Package, path, RootIndex } from '@travetto/manifest';

export const RUNTIME_MODULES = 'trv_node_modules';

const makeIntro = (doImport: (name: string) => string): string => `
try { (${doImport('child_process')}).execFileSync('mkdir -p node_modules/ && cp -r ${RUNTIME_MODULES}/* node_modules/', { shell:true}); } catch {}
try { globalThis.crypto = ${doImport('crypto')}; } catch {}
try { ${doImport('./.env.js')} } catch {}
`;

const INTRO = {
  commonjs: `${makeIntro(v => `require('${v}')`)}
  ${__importStar.toString().replace(/function([^(]+)/, 'function __importStar')}`,
  module: makeIntro(v => `await import('${v}')`)
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
