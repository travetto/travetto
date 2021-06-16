import { FsUtil, PathUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';
import { CliUtil } from '@travetto/cli/src/util';

import { PackUtil } from '../lib/util';
import { CommonConfig, PackOperation } from '../lib/types';
import { AssembleUtil } from '../lib/assemble';

export interface AssembleConfig extends CommonConfig {
  keepSource: boolean;
  readonly: boolean;
  cacheDir: string;
  add: Record<string, string>[];
  exclude: string[];
  excludeCompile: string[];
  env: Record<string, string | undefined>;
}

/**
 * Utils for packing source code and minimizing space usage
 */
export const Assemble: PackOperation<AssembleConfig> = {
  key: 'assemble',
  title: 'Assembling',
  context(cfg: AssembleConfig) {
    return `[readonly=${cfg.readonly},cache=${cfg.cacheDir}]`;
  },
  overrides: {
    keepSource: CliUtil.toBool(process.env.PACK_ASSEMBLE_KEEP_SOURCE),
    readonly: CliUtil.toBool(process.env.PACK_ASSEMBLE_READONLY)
  },
  extend(a: AssembleConfig, b: Partial<AssembleConfig>) {
    return {
      ...PackUtil.commonExtend(a, b),
      keepSource: b.keepSource ?? a.keepSource,
      readonly: b.readonly ?? a.readonly,
      cacheDir: b.cacheDir ?? a.cacheDir,
      add: [...(b.add ?? []), ...(a.add ?? [])],
      exclude: [...(b.exclude ?? []), ...(a.exclude ?? [])],
      excludeCompile: [...(b.excludeCompile ?? []), ...(a.excludeCompile ?? [])],
      env: { ...(b.env ?? {}), ...(a.env ?? {}) },
    };
  },
  /**
   * Assemble the project into a workspace directory, optimized for space and runtime
   */
  async* exec({ workspace, cacheDir, add, exclude, excludeCompile, env, keepSource, readonly }: AssembleConfig) {
    const fullCacheDir = PathUtil.resolveUnix(workspace!, cacheDir);
    const ws = PathUtil.resolveUnix(workspace!);

    yield 'Cleaning Workspace'; await FsUtil.unlinkRecursive(ws).then(() => { });
    yield 'Copying Dependencies'; await AssembleUtil.copyDependencies(ws);
    yield 'Copying App Content'; await AssembleUtil.copyModule(PathUtil.cwd, ws);
    yield 'Excluding Pre-Compile Files'; await AssembleUtil.excludeFiles(ws, excludeCompile);
    yield 'Building'; await AssembleUtil.buildWorkspace(ws, cacheDir);
    yield 'Excluding Post-Compile Files'; await AssembleUtil.excludeFiles(ws, exclude);
    yield 'Copying Added Content'; await AssembleUtil.copyAddedContent(ws, add);
    yield 'Removing Empty Folders'; await PackUtil.removeEmptyFolders(ws);
    yield 'Writng Env.js'; await PackUtil.writeEnvJs(ws, {
      ...env,
      TRV_CACHE: `\${__dirname}/${cacheDir}`,
      ...(readonly ? { TRV_READONLY: '1' } : {})
    });

    if (!keepSource) {
      yield 'Remove Source Maps'; await AssembleUtil.cleanCache(fullCacheDir);
      yield 'Emptying .ts Files'; await AssembleUtil.purgeSource([`${ws}/node_modules/@travetto`, `${ws}/src`]);
    }

    yield color`${{ success: 'Successfully' }} assembled project at ${{ path: workspace }}`;
  }
};