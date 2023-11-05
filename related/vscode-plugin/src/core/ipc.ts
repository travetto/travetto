import { ExtensionContext } from 'vscode';

import { CompilerClient } from '@travetto/base';

import { TargetEvent } from './types';
import { Log } from './log';
import { Workspace } from './workspace';

export class IpcSupport {

  #ctrl = new AbortController();
  #handler: (response: TargetEvent) => void | Promise<void>;
  #log = new Log('travetto.vscode.ipc');

  constructor(handler: (response: TargetEvent) => (void | Promise<void>)) {
    this.#handler = handler;
  }

  async activate(ctx: ExtensionContext): Promise<void> {
    const IPC_FLAG = `${process.ppid}`;
    ctx.environmentVariableCollection.replace('TRV_CLI_IPC', IPC_FLAG);

    const client = new CompilerClient({ url: Workspace.compilerServerUrl, signal: this.#ctrl.signal });

    while (!this.#ctrl.signal.aborted) {
      for await (const ev of client.fetchEvents<'custom', TargetEvent & { ipc?: string }>('custom')) {
        if (ev.ipc === IPC_FLAG) {
          this.#log.info('Received IPC event', ev);
          this.#handler(ev);
        }
      }
      if (!this.#ctrl.signal.aborted) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  deactivate(): void {
    this.#ctrl.abort();
  }
}