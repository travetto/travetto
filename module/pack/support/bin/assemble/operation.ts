import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { cliTpl } from '@travetto/cli';
import { Env } from '@travetto/base';

import { PackUtil } from '../util';
import { CommonConfig, PackOperation } from '../types';
import { AssembleUtil } from './util';
export interface AssembleConfig extends CommonConfig {
  keepSource: boolean;
  readonly: boolean;
  add: Record<string, string>[];
  exclude: string[];
  env: Record<string, string | undefined>;
}

/**
 * Utils for packing source code and minimizing space usage
 */
export const Assemble: PackOperation<AssembleConfig, 'assemble'> = {
  key: 'assemble',
  title: 'Assembling',
  context(cfg: AssembleConfig) {
    return `[readonly=${cfg.readonly},source=${cfg.keepSource}]`;
  },
  overrides: {
    keepSource: Env.getBoolean('PACK_ASSEMBLE_KEEP_SOURCE'),
    readonly: Env.getBoolean('PACK_ASSEMBLE_READONLY')
  },
  extend(src: Partial<AssembleConfig>, dest: Partial<AssembleConfig>): Partial<AssembleConfig> {
    return {
      keepSource: src.keepSource ?? dest.keepSource,
      readonly: src.readonly ?? dest.readonly,
      add: [...(src.add ?? []), ...(dest.add ?? [])],
      exclude: [...(src.exclude ?? []), ...(dest.exclude ?? [])],
      env: { ...(src.env ?? {}), ...(dest.env ?? {}) },
    };
  },
  buildConfig(configs: Partial<AssembleConfig>[]): AssembleConfig {
    return PackUtil.buildConfig(this, configs);
  },
  /**
   * Assemble the project into a workspace directory, optimized for space and runtime
   */
  async * exec({ workspace, add, exclude, env, keepSource }: AssembleConfig) {
    const ws = path.resolve(workspace!);
    yield 'Cleaning Workspace'; {
      await fs.rm(ws, { recursive: true, force: true }).catch(() => { });
      await fs.mkdir(ws);
    }
    yield 'Create Entrypoint'; await AssembleUtil.copyEntryPoint(ws);
    yield 'Copying Prod Dependencies'; await AssembleUtil.copyProdDependencies(ws, keepSource);
    yield 'Excluding Files'; await AssembleUtil.excludeFiles(ws, exclude);
    yield 'Copying Added Content'; await AssembleUtil.copyAddedContent(ws, add);
    yield 'Removing Empty Folders'; await AssembleUtil.removeEmptyFolders(ws);
    yield cliTpl`${{ success: 'Successfully' }} assembled project at ${{ path: workspace }}`;
  }
};