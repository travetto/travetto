import fs from 'fs/promises';

import { Env, ExecUtil } from '@travetto/base';
import { ManifestModule, path, RootIndex } from '@travetto/manifest';

export type AssembleConfig = {
  compress?: boolean;
  sourcemaps?: boolean;
  sources?: boolean;
  output: string;
  entryFile: string;
  entryName: string;
  input: string[];
  modules: ManifestModule[];
  esm: boolean;
  postBuild?: (config: AssembleConfig) => Promise<void>;
};

export function getAssembleConfig(): AssembleConfig {
  const modules = [...RootIndex.getModuleList('all')]
    .map(x => RootIndex.manifest.modules[x])
    .filter(m => m.profiles.includes('std'));

  const input = modules.flatMap(m => [
    ...m.files.$index ?? [],
    ...m.files.src ?? [],
    ...m.files.bin ?? [],
    ...(m.files.support ?? [])
      .filter(f => !/support\/(test|transform|doc|pack)/.test(f[0]))
  ]
    .filter(([, t]) => t === 'ts' || t === 'js' || t === 'json')
    .map(([f]) => path.resolve(m.output, f.replace(/[.]ts$/, '.js'))));

  const entryFile = Env.get('TRV_ASSEMBLE_ENTRY', 'node_modules/@travetto/cli/support/cli.js');
  const entryName = Env.get('TRV_ASSEMBLE_ENTRY_NAME', path.basename(entryFile).replace(/[.][tj]s$/, ''));

  const postBuild = async (config: AssembleConfig): Promise<void> => {
    // Ensure we run cli to generate app cache
    if (entryName === 'cli' || entryName === 'trv') {
      const out = await ExecUtil.spawn('npx',
        ['trv', 'main', '@travetto/app/support/bin/list'],
        { cwd: RootIndex.mainModule.source, env: { DEBUG: '0' } }
      ).result;

      const file = path.resolve(config.output, RootIndex.manifest.modules[RootIndex.mainModule.name].output, 'trv-app-cache.json');
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, out.stdout, 'utf8');
    }
  };

  return {
    modules,
    input,
    compress: Env.getBoolean('TRV_ASSEMBLE_COMPRESS') ?? true,
    sourcemaps: Env.getBoolean('TRV_ASSEMBLE_SOURCEMAP') ?? false,
    sources: Env.getBoolean('TRV_ASSEMBLE_SOURCES') ?? false,
    output: path.resolve(Env.get('TRV_ASSEMBLE_OUTPUT', 'dist')),
    entryFile,
    entryName,
    esm: Env.getBoolean('TRV_ASSEMBLE_ESM') ?? false,
    postBuild
  };
}