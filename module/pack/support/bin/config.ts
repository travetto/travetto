import type { OutputOptions } from 'rollup';
import { __importStar } from 'tslib';

import type terser from '@rollup/plugin-terser';

import { ManifestModule, ManifestModuleUtil, NodeModuleType, path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { EnvProp } from '@travetto/base';

const INTRO = {
  commonjs: __importStar.toString().replace(/function([^(]+)/, 'function __importStar'),
  module: ''
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
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const format = (process.env.BUNDLE_FORMAT ?? 'commonjs') as NodeModuleType;
  const dir = process.env.BUNDLE_OUTPUT!;
  const mainFile = process.env.BUNDLE_MAIN_FILE!;
  return {
    format,
    intro: INTRO[format],
    sourcemapPathTransform: (src, map): string =>
      path.resolve(path.dirname(map), src).replace(`${RuntimeContext.workspacePath}/`, ''),
    sourcemap: new EnvProp('BUNDLE_SOURCEMAP').bool ?? false,
    sourcemapExcludeSources: !(new EnvProp('BUNDLE_SOURCES').bool ?? false),
    compact: new EnvProp('BUNDLE_COMPRESS').bool ?? true,
    file: path.resolve(dir, mainFile),
    ...(format === 'commonjs' ? {} : {
      inlineDynamicImports: true
    }),
  };
}

export function getEntry(): string {
  return process.env.BUNDLE_ENTRY!;
}

export function getFiles(): string[] {
  return [...RuntimeIndex.getModuleList('all')]
    .map(x => RuntimeIndex.getManifestModule(x))
    .filter(m => m.prod)
    .flatMap(getFilesFromModule);
}

export function getIgnoredModules(): string[] {
  return [...RuntimeIndex.getModuleList('all')]
    .map(x => RuntimeIndex.getManifestModule(x))
    .filter(m => !m.prod)
    .map(m => m.name);
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
