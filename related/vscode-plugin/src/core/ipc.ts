import { ExtensionContext } from 'vscode';

import { StreamUtil } from '@travetto/base';

import { TargetEvent } from './types';
import { Workspace } from './workspace';

const isIpcCommand = (o: unknown): o is TargetEvent =>
  o !== null && o !== undefined && typeof o === 'object' &&
  Object.keys(o).length === 2 &&
  'type' in o && 'data' in o &&
  typeof o.data === 'object';

export class IpcSupport {

  static #lineToEvent(line: string): TargetEvent | undefined {
    try {
      line = line.trim();
      if (!line) {
        return;
      }
      console.log('Received line', line);
      const cmd: TargetEvent = JSON.parse(line);
      if (isIpcCommand(cmd)) {
        return cmd;
      } else {
        console.error('Unsupported command', line);
      }
    } catch (e) {
      console.error(e);
    }
  }

  #active = true;
  #handler: (response: TargetEvent) => void | Promise<void>;

  constructor(handler: (response: TargetEvent) => (void | Promise<void>)) {
    this.#handler = handler;
  }

  async activate(ctx: ExtensionContext): Promise<void> {
    const file = Workspace.resolveExtensionFile(`ipc_${process.ppid}.ndjson`);
    ctx.environmentVariableCollection.replace('TRV_CLI_IPC', file);

    while (this.#active) {
      console.log('Starting ipc handler', file);
      try {
        for await (const line of StreamUtil.streamLines(file, true)) {
          const ev = IpcSupport.#lineToEvent(line);
          if (ev) {
            await this.#handler(ev);
          }
        }
      } catch (err) {
        // Continue until deactivated
      }
    }
  }

  deactivate(): void {
    this.#active = false;
  }
}