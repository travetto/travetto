import vscode from 'vscode';
import { EventEmitter } from 'node:stream';

import { CompilerClient } from '@travetto/base';

import { Log } from './log';
import { Workspace } from './workspace';

type ProgressBar = vscode.Progress<{ message: string, increment?: number }>;
type ProgressState = { prev: number, bar: ProgressBar, cleanup: () => void };

const SCOPE_MAX = 15;

/**
 * Represents the general build status of the workspace, allowing operations to wait for builds to be complete before running
 */
export class CompilerServer {

  static #item: vscode.StatusBarItem;
  static #emitter = new EventEmitter();
  static #log = new Log('travetto.build-status');

  static async init(ctx: vscode.ExtensionContext): Promise<void> {
    this.#item = vscode.window.createStatusBarItem('travetto.build', vscode.StatusBarAlignment.Left, 1000);
    this.#item.text = '$(debug-pause) Disconnected';
    this.#item.show();
    vscode.commands.registerCommand('travetto.show-log', () => this.#log.show());
    this.#item.command = { command: 'travetto.show-log', title: 'Show Logs' };

    // Start the listener
    this.#trackConnected();
  }

  static async #trackConnected(): Promise<void> {
    this.#log.info('Initial connection at', Workspace.compilerServerUrl);
    const simple = new CompilerClient({ url: Workspace.compilerServerUrl });

    for (; ;) {
      const ctrl = new AbortController();
      let connected = false;
      try {
        if (await simple.getInfo()) {
          this.#emitter.emit('connect');
          connected = true;

          const client = new CompilerClient({ url: Workspace.compilerServerUrl, signal: ctrl.signal });
          this.#log.info('Connecting to compiler', Workspace.compilerServerUrl);
          await Promise.race([this.#trackLog(client), this.#trackState(client), this.#trackProgress(client, ctrl.signal)]);
        } else {
          this.#log.debug('Server not running');
        }
      } catch (err) {
        this.#log.info('Failed to connect', `${err}`);
      }

      if (connected) {
        this.#emitter.emit('disconnect');
        this.#log.info('Disconnecting', !!ctrl.signal.aborted);
      }
      ctrl.abort();
      // Check every second
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  static onServerConnected(handler: Function): void {
    this.#emitter.on('connect', () => handler());
  }

  static onServerDisconnected(handler: Function): void {
    this.#emitter.on('disconnect', () => handler());
  }

  static #onState(state: string): void {
    switch (state) {
      case 'reset': this.#item.text = '$(flame) Restarting'; break;
      case 'init': this.#item.text = '$(flame) Initializing'; break;
      case 'compile-start': this.#item.text = '$(flame) Compiling'; break;
      case 'compile-end':
      case 'watch-start': this.#item.text = '$(pass-filled) Ready'; break;
    }
  }

  static async #trackState(client: CompilerClient): Promise<void> {
    try {
      const info = (await client.getInfo())!;
      this.#onState(info.state);
      for await (const ev of client.fetchEvents('state')) {
        this.#onState(ev.state);
      }
    } finally {
      this.#item.text = '$(debug-pause) Disconnected';
    }
  }

  static async #trackLog(client: CompilerClient): Promise<void> {
    for await (const ev of client.fetchEvents('log')) {
      const message = ev.message.replaceAll(Workspace.path, '.');
      const params = [message, ...ev.args ?? []];
      if (ev.scope) {
        params.unshift(`[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`);
      }
      this.#log[ev.level](params[0], ...params.slice(1));
    }
  }

  static async #trackProgress(client: CompilerClient, signal: AbortSignal): Promise<void> {
    const state: Record<string, ProgressState> = {};

    for await (const ev of client.fetchEvents('progress')) {
      let pState = state[ev.operation];

      const value = 100 * (ev.idx / ev.total);
      const delta = (value - pState?.prev ?? 0);

      if (ev.complete || delta < 0) {
        pState?.cleanup();
        delete state[ev.operation];
        continue;
      }

      if (!pState) {
        const ctrl = new AbortController();
        const complete = Workspace.manualPromise();
        const kill = ctrl.abort.bind(ctrl);
        signal.addEventListener('abort', kill);

        const st: Omit<ProgressState, 'bar'> = {
          prev: 0,
          cleanup: () => {
            signal.removeEventListener('abort', kill);
            complete.resolve(null);
          }
        };

        pState = state[ev.operation] = {
          ...st,
          bar: await new Promise<ProgressBar>(resolve =>
            vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, cancellable: false, title: ev.operation.charAt(0).toUpperCase() + ev.operation.substring(1) },
              p => {
                resolve(p);
                return complete;
              }
            )
          )
        };
      }

      pState.prev = value;
      pState.bar.report({ message: `${Math.trunc(value)}% (Files: ${ev.idx + 1}/${ev.total})`, increment: delta });
    }
  }
}