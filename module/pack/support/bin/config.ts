import type fs from 'node:fs';
import type { OutputOptions } from 'rollup';

import type terser from '@rollup/plugin-terser';

import { ManifestModule, ManifestModuleUtil, NodeModuleType, path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { EnvProp } from '@travetto/base';

// eslint-disable-next-line @typescript-eslint/naming-convention
function __init(mod: typeof fs, file?: string, freezeProto?: boolean): void {
  if (freezeProto !== false) {
    // @ts-expect-error -- Lock to prevent __proto__ pollution in JSON
    const objectProto = Object.prototype.__proto__;
    Object.defineProperty(Object.prototype, '__proto__', {
      get() { return objectProto; },
      set(val) { Object.setPrototypeOf(this, val); }
    });
  }

  if (file) {
    if (process.env.TRV_MODULE) { return; }
    try {
      mod.readFileSync(file, 'utf8')
        .split('\n')
        .map(x => x.match(/\s*(?<key>[^ =]+)\s*=\s*(?<value>\S+)/)?.groups)
        .filter((x): x is Exclude<typeof x, null | undefined> => !!x)
        .forEach(x => process.env[x.key] = x.value);
    } catch { }
  }
}

const INTRO = (envFile: string | undefined, sourceMap?: boolean): Record<NodeModuleType, string> => ({
  commonjs: `(${__init.toString()})(require('node:fs'), '${envFile}', ${!!sourceMap})`,
  module: `(${__init.toString()})(await import('node:fs'), '${envFile}', ${!!sourceMap})`
});

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
    interop: format === 'commonjs' ? 'auto' : undefined,
    intro: INTRO(new EnvProp('BUNDLE_ENV_FILE').val)[format],
    sourcemapPathTransform: (src, map): string =>
      path.resolve(path.dirname(map), src).replace(`${RuntimeContext.workspace.path}/`, ''),
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
