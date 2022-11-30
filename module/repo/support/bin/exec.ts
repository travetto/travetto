import { ChildProcess } from 'child_process';

import { WorkPool, IterableWorkSet } from '@travetto/worker';
import { ExecUtil, type ExecutionOptions } from '@travetto/base';
import { Package, PackageUtil } from '@travetto/manifest';
import { CliUtil } from '@travetto/cli';

import { Repo } from './repo';
import { Git } from './git';

import { Cmd, RepoWorker, CmdRes } from './worker';

export type CmdConfig = {
  mode?: 'all' | 'changed';
  globalTests?: boolean;
  extraFolders?: string[];
  extraFilter?: (extra: string, folderMap: Map<string, Package>) => (boolean | Promise<boolean>);
  workers?: number;
};

export class Exec {
  static forCommand(folder: string, cmd: string, args: string[], opts?: ExecutionOptions): { process: ChildProcess } & CmdRes {
    const { process: proc, result } = ExecUtil.spawn(cmd, args, {
      cwd: folder,
      ...opts
    });
    const kill = (): void => { proc.kill('SIGTERM'); };
    proc.on('error', kill);
    result.catch((err) => {
      console.error(`${folder}: ${err}`);
    });
    return { result, kill, process: proc };
  }

  static async build(cmd: CmdConfig = {}): Promise<void> {
    // Build all
    return CliUtil.waiting('Building all modules', () =>
      this.parallel(
        folder => Exec.forCommand(
          folder, 'trv', ['build'],
          { stdio: [0, process.env.DEBUG ? 1 : 'ignore', 2], env: { TRV_MANIFEST: '' } }
        ),
        { ...cmd, workers: 4 })
    );
  }

  static async parallel(command: Cmd, config: CmdConfig = {}): Promise<void> {

    const folders = (await (config.mode === 'all' ? Repo.modules : Git.findChangedModulesRecursive()))
      .map(x => x.rel);

    let extra = new Set(config.extraFolders ?? []);

    const folderMap = new Map<string, Package>();
    for (const folder of folders) {
      folderMap.set(folder, PackageUtil.readPackage(folder));
    }

    if (config.extraFilter) {
      extra = new Set();
      for (const el of config.extraFolders ?? []) {
        if (await config.extraFilter(el, folderMap)) {
          extra.add(el);
        }
      }
    }

    if (config.globalTests) {
      for (const test of (await Repo.root).pkg.travettoRepo?.globalTests ?? []) {
        try {
          const pkg = PackageUtil.readPackage(test);
          for (const [, { name }] of folderMap) {
            if (config.mode === 'all' || name in (pkg.dependencies ?? {})) {
              extra.add(test);
            }
          }
        } catch { }
      }
    }

    const pool = new WorkPool(() => new RepoWorker(command), { max: config.workers ?? undefined });
    const work = new IterableWorkSet([...folders, ...([...extra ?? []]).sort()]);
    return pool.process(work);
  }
}