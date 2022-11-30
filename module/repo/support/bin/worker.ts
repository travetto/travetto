import { Worker } from '@travetto/worker';

export type CmdRes = { result: Promise<unknown>, kill: () => unknown };
export type Cmd = (folder: string) => Promise<CmdRes> | CmdRes;

export class RepoWorker implements Worker<string> {

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