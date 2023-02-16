import { createReadStream, watchFile } from 'fs';
import fs from 'fs/promises';
import rl from 'readline';
import { ExtensionContext } from 'vscode';

import { path } from '@travetto/manifest';

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


  static async * readTargetEvents(file: string): AsyncIterable<TargetEvent> {
    for await (const ev of fs.watch(file, { persistent: true })) {
      const stream = createReadStream(file, { autoClose: true, emitClose: true });
      for await (const line of rl.createInterface(stream)) {
        const res = this.#lineToEvent(line);
        if (res) {
          yield res;
        }
      }
    }
  }

  #active = true;
  #handler: (response: TargetEvent) => void | Promise<void>;

  constructor(handler: (response: TargetEvent) => (void | Promise<void>)) {
    this.#handler = handler;
  }

  async activate(ctx: ExtensionContext): Promise<void> {
    const file = Workspace.resolveOutputFile(`trv_ipc_vscode_${process.ppid}.ndjson`);
    ctx.environmentVariableCollection.replace('TRV_CLI_IPC', file);

    if (await fs.stat(file).catch(() => false)) {
      await fs.truncate(file);
    }

    while (this.#active) {
      console.log('Starting ipc handler', file);
      // Ensure file    
      if (!await fs.stat(file).catch(() => false)) {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.appendFile(file, '', 'utf8');
      }

      try {
        for await (const cmd of IpcSupport.readTargetEvents(file)) {
          await this.#handler(cmd);
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