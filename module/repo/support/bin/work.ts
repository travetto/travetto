import { type SpawnOptions, ChildProcess } from 'child_process';

import { Worker, WorkPool, IterableWorkSet } from '@travetto/worker';
import { ExecUtil } from '@travetto/base';
import { Package, PackageUtil } from '@travetto/manifest';

import { Repo } from './repo';
import { Git } from './git';

type CmdRes = { result: Promise<unknown>, kill: () => unknown };
type Cmd = (folder: string) => Promise<CmdRes> | CmdRes;
export type CmdConfig = {
  mode?: 'all' | 'changed';
  extraFolders?: string[];
  extraFilter?: (extra: string, folderMap: Map<string, Package>) => (boolean | Promise<boolean>);
  workers?: number;
};

export class RepoWorker implements Worker<string> {

  static forCommand(folder: string, cmd: string, args: string[], stdio: SpawnOptions['stdio']): { process: ChildProcess } & CmdRes {
    const { process: proc, result } = ExecUtil.spawn(cmd, args, {
      cwd: folder, env: { TRV_OUTPUT: '', TRV_COMPILER: '' }, stdio
    });
    const kill = (): void => { proc.kill('SIGTERM'); };
    proc.on('error', kill);
    result.catch((err) => {
      console.error(`${folder}: ${err}`);
    });
    return { result, kill, process: proc };
  }

  static async exec(
    command: Cmd,
    config: CmdConfig = {}
  ): Promise<void> {

    const folders = (await (config.mode === 'all' ? Repo.modules : Git.findChangedModulesRecursive()))
      .map(x => x.rel);

    let extra = config.extraFolders;

    if (config.extraFilter) {
      extra = [];
      const folderMap = new Map<string, Package>();
      for (const folder of folders) {
        folderMap.set(folder, PackageUtil.readPackage(folder));
      }
      for (const el of config.extraFolders ?? []) {
        if (await config.extraFilter(el, folderMap)) {
          extra.push(el);
        }
      }
    }

    const pool = new WorkPool(() => new RepoWorker(command), { max: config.workers ?? undefined });
    const work = new IterableWorkSet([...folders, ...extra ?? []]);
    return pool.process(work);
  }

  static #id = 0;

  id = RepoWorker.#id += 1;
  active = false;

  kill?: () => void;

  #command: Cmd;

  constructor(command: Cmd) {
    this.#command = command;
  }

  async destroy(): Promise<void> {
    this.kill?.();
    this.active = false;
  }

  async execute(folder: string): Promise<void> {
    try {
      this.active = true;
      const { result, kill } = await this.#command(folder);
      this.kill = kill;
      await result;
    } finally {
      this.active = false;
    }
  }
}