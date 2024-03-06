import type { OutputOptions } from 'rollup';

import type terser from '@rollup/plugin-terser';

import { ManifestModule, ManifestModuleUtil, NodeModuleType, path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { EnvProp } from '@travetto/base';
import { CoreRollupConfig } from '../../src/types';

function getFilesFromModule(m: ManifestModule): string[] {
  return [
    ...m.files.$index ?? [],
    ...m.files.src ?? [],
    ...(m.files.bin ?? []).filter(f => !(/bin\/trv[.]js$/.test(f[0]) && m.name === '@travetto/cli')),
    ...(m.files.support ?? [])
      .filter(f => !/support\/(test|doc|pack)/.test(f[0]))
  ]
    .filter(([, t]) => t === 'ts' || t === 'js' || t === 'json')
    .filter(f => (f[3] ?? 'std') === 'std') // Only include standard files
    .map(([f]) => ManifestModuleUtil.sourceToOutputExt(path.resolve(m.outputFolder, f)));
}

export function getOutput(): OutputOptions {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const format = (process.env.BUNDLE_FORMAT ?? 'commonjs') as NodeModuleType;
  const dir = process.env.BUNDLE_OUTPUT!;
  const mainFile = process.env.BUNDLE_MAIN_FILE!;
  return {
    format,
    interop: format === 'commonjs' ? 'auto' : undefined,
    sourcemapPathTransform: (src, map): string =>
      RuntimeContext.stripWorkspacePath(path.resolve(path.dirname(map), src)),
    sourcemap: new EnvProp('BUNDLE_SOURCEMAP').bool ?? false,
    sourcemapExcludeSources: !(new EnvProp('BUNDLE_SOURCES').bool ?? false),
    compact: new EnvProp('BUNDLE_COMPRESS').bool ?? true,
    file: path.resolve(dir, mainFile),
    inlineDynamicImports: true
  };
}

export function getEntry(): string {
  return process.env.BUNDLE_ENTRY!;
}

export function getFiles(entry?: string): string[] {
  return [...RuntimeIndex.getModuleList('all')]
    .map(x => RuntimeIndex.getManifestModule(x))
    .filter(m => m.prod)
    .flatMap(getFilesFromModule)
    .filter(x => (!entry || !x.endsWith(entry)) && !x.includes('@travetto/pack/support'));
}

export function getIgnoredModules(): ManifestModule[] {
  return [...RuntimeIndex.getModuleList('all')]
    .map(x => RuntimeIndex.getManifestModule(x))
    .filter(m => !m.prod);
}

export function getMinifyConfig(): Parameters<typeof terser>[0] {
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

export function getCoreConfig(): CoreRollupConfig {
  const output = getOutput();
  const entry = getEntry();
  const files = getFiles(entry);
  const ignoreModules = getIgnoredModules();
  const ignoreFiles = ignoreModules.flatMap(getFilesFromModule);
  const minify = getMinifyConfig();
  const envFile = new EnvProp('BUNDLE_ENV_FILE').val;

  return {
    output, entry, files, envFile, minify,
    ignore: new Set([...ignoreModules.map(x => x.name), ...ignoreFiles]),
  };
}