import fs from 'fs';
import rl from 'readline';
import { ExtensionContext } from 'vscode';

import { path } from '@travetto/manifest';

import { TargetEvent } from './types';
import { Workspace } from './workspace';

export class IpcSupport {

  static createLineReader(file: string, handler: (event: TargetEvent) => void | Promise<void>): rl.ReadLine {
    return rl.createInterface(
      fs.createReadStream(file, { autoClose: true, emitClose: true })
    ).on('line', async line => {
      try {
        line = line.trim();
        if (!line) {
          return;
        }
        const cmd: TargetEvent = JSON.parse(line);
        if (
          Object.keys(cmd).length === 2 &&
          'type' in cmd && 'data' in cmd &&
          typeof cmd.data === 'object'
        ) {
          await handler(cmd);
        } else {
          console.error('Unsupported command', line);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }


  #lineReader: rl.Interface;
  #file: string;
  #active: boolean | undefined;
  #handler: (response: TargetEvent) => void | Promise<void>;
  #timeoutId: NodeJS.Timeout | undefined;

  constructor(handler: (response: TargetEvent) => (void | Promise<void>)) {
    this.#handler = handler;
  }

  #ensureFile(): void {
    fs.mkdirSync(path.dirname(this.#file), { recursive: true });
    if (fs.existsSync(this.#file)) {
      fs.unlinkSync(this.#file);
    }
    fs.appendFileSync(this.#file, '');
  }

  #activate(): void {
    if (this.#active === false) {
      return;
    }
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = undefined;
    }
    this.#active = true;
    this.#lineReader = IpcSupport.createLineReader(this.#file, this.#handler);
    this.#lineReader.on('close', () => {
      if (this.#timeoutId) {
        return;
      }
      this.#ensureFile();
      this.#timeoutId = setTimeout(() => this.#activate(), 250);
    });
  }

  activate(ctx: ExtensionContext): void {
    this.#file = Workspace.resolveOutputFile(`trv_ipc_vscode_${process.ppid}.ndjson`);
    this.#ensureFile();

    ctx.environmentVariableCollection.replace('TRV_CLI_IPC', this.#file);
    this.#activate();
  }

  deactivate(): void {
    this.#active = false;
    this.#lineReader.close();
  }
}