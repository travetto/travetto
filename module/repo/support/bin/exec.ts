import { ChildProcess } from 'child_process';

import { WorkPool, IterableWorkSet } from '@travetto/worker';
import { ExecUtil, type ExecutionOptions } from '@travetto/base';
import { Package, PackageUtil } from '@travetto/manifest';

import { Repo } from './repo';
import { Git } from './git';

import { Cmd, RepoWorker, CmdRes } from './worker';

export type CmdConfig = {
  mode?: 'all' | 'changed';
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

    const pool = new WorkPool(() => new RepoWorker(command), { max: config.workers ?? undefined });
    const work = new IterableWorkSet([...folders, ...([...extra ?? []]).sort()]);
    return pool.process(work);
  }
}