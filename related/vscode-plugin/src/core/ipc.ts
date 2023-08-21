import { ExtensionContext } from 'vscode';
import fs from 'fs/promises';
import { setTimeout } from 'timers/promises';

import { StreamUtil } from '@travetto/base';

import { TargetEvent } from './types';
import { Workspace } from './workspace';
import { Log } from './log';

const isIpcCommand = (o: unknown): o is TargetEvent =>
  o !== null && o !== undefined && typeof o === 'object' &&
  Object.keys(o).length === 2 &&
  'type' in o && 'data' in o &&
  typeof o.data === 'object';

export class IpcSupport {

  #active = true;
  #handler: (response: TargetEvent) => void | Promise<void>;
  #log = new Log('travetto.vscode.ipc');

  constructor(handler: (response: TargetEvent) => (void | Promise<void>)) {
    this.#handler = handler;
  }

  #lineToEvent(line: string): TargetEvent | undefined {
    try {
      line = line.trim();
      if (!line) {
        return;
      }
      this.#log.info('Received line', line);
      const cmd: TargetEvent = JSON.parse(line);
      if (isIpcCommand(cmd)) {
        return cmd;
      } else {
        this.#log.error('Unsupported command', line);
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('Unexpected token')) {
          throw e;
        } else {
          this.#log.error(e.message, e);
        }
      } else {
        throw e;
      }
    }
  }


  async activate(ctx: ExtensionContext): Promise<void> {
    const file = Workspace.resolveToolFile(`ipc_${process.ppid}.ndjson`);
    ctx.environmentVariableCollection.replace('TRV_CLI_IPC', file);

    while (this.#active) {
      this.#log.info('Watching file', file);
      try {
        for await (const line of StreamUtil.streamLines(file, true)) {
          const ev = this.#lineToEvent(line);
          if (ev) {
            await this.#handler(ev);
          }
        }
        this.#log.info('Watching file successfully ended', file);
      } catch (err) {
        await fs.unlink(file).catch(() => { }); // Delete file on failure
        this.#log.error('Error in ipc watching', err);
        // Continue until deactivated
      }
      if (this.#active) {
        await setTimeout(1500); // Wait 1.5 seconds before continuing
      }
    }
  }

  deactivate(): void {
    this.#active = false;
  }
}