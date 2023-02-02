import fs from 'fs/promises';
import path from 'path';

// @ts-expect-error
import multipleInput from 'rollup-plugin-multi-input';
import commonjsRequire from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import jsonImport from '@rollup/plugin-json';

import sourceMaps from 'rollup-plugin-sourcemaps';
import type { Plugin, RollupOptions } from 'rollup';

import { type ManifestModule, RootIndex } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

function getExportingModules(): ManifestModule[] {
  return [...RootIndex.getModuleList('all')]
    .map(x => RootIndex.manifest.modules[x])
    .filter(m => m.profiles.includes('std'));
}

function getInputFiles(modules: ManifestModule[]): string[] {
  return modules.flatMap(m => [
    ...m.files.$index ?? [],
    ...m.files.src ?? [],
    ...m.files.bin ?? [],
    ...(m.files.support ?? [])
      .filter(f => !/support\/(test|transform|doc|pack)/.test(f[0]))
  ]
    .filter(([, t]) => t === 'ts' || t === 'js' || t === 'json')
    .map(([f]) => path.resolve(m.output, f.replace(/[.]ts$/, '.js'))));
}

function travettoPlugin(out: string, modules: ManifestModule[]): Plugin {
  async function copyToOut(mod: ManifestModule, file: string): Promise<void> {
    const src = path.resolve(mod.output, file);
    const dest = path.resolve(out, mod.output, file);
    if (await fs.stat(src).then(_ => true, _ => false)) {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
    }
  }

  async function writeRawFile(file: string, contents: string, mode?: string): Promise<void> {
    await fs.writeFile(path.resolve(out, file), contents, { encoding: 'utf8', mode });
  }


  const plugin: Plugin = {
    name: 'travetto-plugin',
    async buildStart(): Promise<void> {
      await fs.rm(out, { recursive: true });
    },
    async buildEnd(): Promise<void> {
      // Ensure we run cli to generate app cache
      try {
        await ExecUtil.spawn('npx', ['trv', 'run'], { cwd: RootIndex.mainModule.source }).result;
      } catch { }

      for (const mod of modules) {
        if (mod.main || mod.name === '@travetto/manifest') {
          await copyToOut(mod, 'package.json');
          await copyToOut(mod, 'trv-app-cache.json');
        }
      }
      const main = RootIndex.manifest.modules[RootIndex.manifest.mainModule];
      await fs.writeFile(path.resolve(out, main.output, 'manifest.json'), JSON.stringify({
        ...RootIndex.manifest,
        outputFolder: path.dirname(out),
        modules: Object.fromEntries(
          Object.entries(RootIndex.manifest.modules)
            .filter(([k, m]) => m.profiles.includes('std'))
        )
      }));

      await writeRawFile('trv', '#!/bin/sh\nnode node_modules/@travetto/cli/support/cli.js $@\n', '755');
      await writeRawFile('trv.cmd', 'node node_modules/@travetto/cli/support/cli.js %*\n', '755');
    }
  };
  return plugin;
}

function buildConfig(): RollupOptions {
  const out = path.resolve(process.env.TRV_PACK_OUTPUT ?? 'dist');

  const modules = getExportingModules();

  const options: RollupOptions = {
    // use glob in the input
    input: ['node_modules/@travetto/cli/support/cli.js'],
    output: {
      intro: 'function __importStar(obj) { return require("tslib").__importStar(obj); }',
      format: 'commonjs',
      sourcemap: true,
      sourcemapExcludeSources: true,
      compact: true,
      dir: out
    },
    plugins: [
      travettoPlugin(out, modules),
      multipleInput(),
      jsonImport(),
      commonjsRequire({
        dynamicRequireRoot: RootIndex.manifest.workspacePath,
        dynamicRequireTargets: [
          ...getInputFiles(modules),
        ]
      }),
      sourceMaps({}),
      terser({
        mangle: true,
        keep_classnames: true,
        keep_fnames: true,
        ecma: 2020,
        compress: {},
        output: {
          shebang: false,
          comments: false,
        }
      }),
      nodeResolve({ preferBuiltins: true }),
    ],
  };

  return options;
}

export default buildConfig();