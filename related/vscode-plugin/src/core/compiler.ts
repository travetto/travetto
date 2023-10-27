/// <reference types="@travetto/fetch-node-types" />
import vscode from 'vscode';
import { EventEmitter, Readable } from 'stream';
import rl from 'readline/promises';

import { Log } from './log';
import { Workspace } from './workspace';

type ProgressBar = vscode.Progress<{ message: string, increment?: number }>;
type ProgressEvent = { idx: number, total: number, message: string, operation: string, complete?: boolean };
type ProgressState = { prev: number, bar: ProgressBar, cleanup: () => void };
type StateEvent = { state: 'compile-start' | 'compile-end' | 'watch-start' | 'watch-end' | 'reset' };
type LogEvent = { level: 'info' | 'warn' | 'error' | 'debug', message: string, args: string[], scope: string, time: number };

const SCOPE_MAX = 15;

async function getInfo(): Promise<{ type: string, iteration: number } | undefined> {
  return await fetch(Workspace.compilerServerUrl('/info'), { timeout: 100 }).then(v => v.ok ? v.json() : undefined).catch(() => undefined);
}

const clientLog = new Log('travetto.compiler-client');

async function* fetchEvents<T>(type: string, signal: AbortSignal): AsyncIterable<T> {
  const url = Workspace.compilerServerUrl(`/event/${type}`);
  for (; ;) {
    try {
      const stream = await fetch(url, { signal, timeout: 60000 });
      for await (const line of rl.createInterface(Readable.fromWeb(stream.body))) {
        if (line.trim().charAt(0) === '{') {
          const val: T = JSON.parse(line);
          yield val;
        }
      }
    } catch (err) {
      if (!signal.aborted) {
        clientLog.error('Failed to stream', err);
      }
    }

    if (signal?.aborted || (await getInfo() === undefined)) { // If health check fails, or aborted
      clientLog.info(`Stopping client due to ${!!signal?.aborted}`);
      return;
    }
  }
}

/**
 * Represents the general build status of the workspace, allowing operations to wait for builds to be complete before running
 */
export class CompilerServer {

  static #connected: boolean = false;
  static #item: vscode.StatusBarItem;
  static #emitter = new EventEmitter();
  static #log = new Log('travetto.build-status');
  static #controller?: AbortController;

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
    for (; ;) {
      try {
        await getInfo();
        await this.connect();
      } catch (err) {
        this.#log.info('Failed to connect', `${err}`);
      }

      this.disconnect();
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

  static async #trackState(): Promise<void> {
    try {
      for await (const ev of fetchEvents<StateEvent>('state', this.#controller!.signal)) {
        switch (ev.state) {
          case 'reset': this.#item.text = '$(flame) Restarting'; break;
          case 'compile-start': this.#item.text = '$(flame) Compiling'; break;
          case 'watch-start': this.#item.text = '$(pass-filled) Ready'; break;
        }
      }
    } finally {
      this.#item.text = '$(debug-pause) Disconnected';
    }
  }

  static async #trackLog(): Promise<void> {
    for await (const ev of fetchEvents<LogEvent>('log', this.#controller!.signal)) {
      const message = ev.message.replaceAll(Workspace.path, '.');
      const params = [message, ...ev.args ?? []];
      if (ev.scope) {
        params.unshift(`[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`);
      }
      this.#log[ev.level](params[0], ...params.slice(1));
    }
  }

  static async #trackProgress(): Promise<void> {
    const state: Record<string, ProgressState> = {};

    for await (const ev of fetchEvents<ProgressEvent>('progress', this.#controller!.signal)) {
      let pState = state[ev.operation];

      if (ev.complete) {
        pState?.cleanup();
        delete state[ev.operation];
        continue;
      }

      if (!pState) {
        const ctrl = new AbortController();
        const complete = Workspace.manualPromise();
        const kill = ctrl.abort.bind(ctrl);
        this.#controller?.signal.addEventListener('abort', kill);

        const st: Omit<ProgressState, 'bar'> = {
          prev: 0,
          cleanup: () => {
            this.#controller?.signal.removeEventListener('abort', kill);
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

      const value = 100 * (ev.idx / ev.total);
      const delta = (value - pState.prev);
      pState.prev = value;
      pState.bar.report({ message: `${Math.trunc(value)}% (Files: ${ev.idx + 1}/${ev.total})`, increment: delta });
    }
  }

  static async connect(): Promise<void> {
    if (this.#connected) {
      return;
    }
    this.#connected = true;
    this.#emitter.emit('connect');
    this.#controller = new AbortController();
    return Promise.race([this.#trackLog(), this.#trackState(), this.#trackProgress()]);
  }

  static disconnect(): void {
    if (!this.#connected) {
      return;
    }
    this.#connected = false;
    this.#emitter.emit('disconnect');
    this.#log.info('Disconnecting', !!this.#controller?.signal.aborted);
    this.#controller?.abort();
  }
}