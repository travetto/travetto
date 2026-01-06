import path from 'node:path';

import type { OutputOptions } from 'rollup';
import type terser from '@rollup/plugin-terser';

import { type ManifestModule, ManifestModuleUtil } from '@travetto/manifest';
import { EnvProp, Runtime, RuntimeIndex } from '@travetto/runtime';

import type { CoreRollupConfig } from '../../src/types.ts';

function getFilesFromModule(mod: ManifestModule): string[] {
  return [
    ...mod.files.$index ?? [],
    ...mod.files.src ?? [],
    ...(mod.files.bin ?? []).filter(file => !(/bin\/trv[.]js$/.test(file[0]) && mod.name === '@travetto/cli')),
    ...(mod.files.support ?? [])
      .filter(file => !/support\/(test|doc|pack)/.test(file[0]))
  ]
    .filter(([, type]) => type === 'ts' || type === 'js' || type === 'json')
    .filter(([, , , role]) => (role ?? 'std') === 'std') // Only include standard files
    .map(([file]) => ManifestModuleUtil.withOutputExtension(path.resolve(mod.outputFolder, file)));
}

export function getOutput(): OutputOptions {
  const output = process.env.BUNDLE_OUTPUT!;
  const mainFile = process.env.BUNDLE_MAIN_FILE!;
  return {
    format: 'module',
    sourcemapPathTransform: (source, map): string =>
      Runtime.stripWorkspacePath(path.resolve(path.dirname(map), source)),
    sourcemap: new EnvProp('BUNDLE_SOURCEMAP').bool ?? false,
    sourcemapExcludeSources: !(new EnvProp('BUNDLE_SOURCES').bool ?? false),
    compact: new EnvProp('BUNDLE_COMPRESS').bool ?? true,
    file: path.resolve(output, mainFile),
    inlineDynamicImports: true
  };
}

export function getEntry(): string {
  return process.env.BUNDLE_ENTRY!;
}

export function getFiles(entry?: string): string[] {
  return [...RuntimeIndex.getModuleList('all')]
    .map(name => RuntimeIndex.getManifestModule(name))
    .filter(mod => mod.prod)
    .flatMap(getFilesFromModule)
    .filter(file => (!entry || !file.endsWith(entry)) && !file.includes('@travetto/pack/support/'));
}

export function getIgnoredModules(): ManifestModule[] {
  return [...RuntimeIndex.getModuleList('all')]
    .map(name => RuntimeIndex.getManifestModule(name))
    .filter(mod => !mod.prod);
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
  const envFile = new EnvProp('BUNDLE_ENV_FILE').value;
  const external = new EnvProp('BUNDLE_EXTERNAL').list ?? [];

  return {
    output, entry, files, envFile, minify, external,
    ignore: new Set([...ignoreModules.map(mod => mod.name), ...ignoreFiles]),
  };
}