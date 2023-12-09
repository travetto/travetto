import rl from 'readline/promises';
import { Readable } from 'stream';

import { RootIndex } from '@travetto/manifest';

import { ShutdownManager } from './shutdown';
import { ExecUtil } from './exec';
import { LogLevel } from './types';
import { AppError } from './error';

type ServerInfo = {
  iteration: number;
  path: string;
  mode: 'watch' | 'build';
  state: 'compile-start' | 'compile-end' | 'watch-start' | 'watch-end' | 'reset' | 'init';
  serverPid: number;
  compilerPid: number;
  env: Record<string, string>;
};

type ChangeEvent = { action: 'create' | 'update' | 'delete', file: string, folder: string, output: string, module: string, time: number };
type ProgressEvent = { idx: number, total: number, message: string, operation: string, complete?: boolean };
type StateEvent = { state: ServerInfo['state'] };
type LogEvent = { level: LogLevel, message: string, args: string[], scope: string, time: number };

type CompilerEvent =
  { type: 'change', payload: ChangeEvent } |
  { type: 'log', payload: LogEvent } |
  { type: 'progress', payload: ProgressEvent } |
  { type: 'state', payload: StateEvent };

type CompilerEventType = CompilerEvent['type'];

type Handler = (ev: ChangeEvent) => (unknown | Promise<unknown>);

/**
 * Utilities for interacting with the compiler
 */
export class CompilerClient {

  #url: string;
  #kill: AbortController;

  constructor(cfg: { url?: string, signal?: AbortSignal } = {}) {
    this.#url = cfg.url ?? RootIndex.manifest.compilerUrl;

    this.#kill = new AbortController();
    if (cfg.signal) {
      cfg.signal.addEventListener('abort', () => this.close());
    }
    ShutdownManager.onGracefulShutdown(async () => this.close(), this);
  }

  close(): void {
    this.#kill.abort();
  }

  #nestedCtrl(signal?: AbortSignal): AbortController & { cleanup?: () => void } {
    const ctrl = new AbortController();
    const kill = (): void => ctrl.abort();
    const parent = signal ?? this.#kill.signal;
    parent.addEventListener('abort', kill);
    Object.assign(ctrl, {
      cleanup: () => {
        parent.removeEventListener('abort', kill);
        ctrl.abort();
      }
    });
    return ctrl;
  }

  /** Get compiler info */
  async getInfo(): Promise<ServerInfo | undefined> {
    const ctrl = this.#nestedCtrl();
    try {
      const res = await fetch(`${this.#url}/info`, { signal: ctrl.signal });
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return (await res.json()) as ServerInfo;
      }
    } catch {
      return;
    } finally {
      ctrl.cleanup?.();
    }
  }

  /** Listen to compiler events */
  async * fetchEvents<
    V extends CompilerEventType,
    T extends (CompilerEvent & { type: V })['payload']
  >(type: V, signal?: AbortSignal): AsyncIterable<T> {
    const info = await this.getInfo();
    if (!info) {
      return;
    }

    const ctrl = this.#nestedCtrl(signal);
    const { iteration } = info;
    for (; ;) {
      try {
        const stream = await fetch(`${this.#url}/event/${type}`, { signal: ctrl.signal });
        for await (const line of rl.createInterface(Readable.fromWeb(stream.body!))) {
          if (line.trim().charAt(0) === '{') {
            yield JSON.parse(line);
          }
        }
      } catch (err) { }

      if (this.#kill.signal?.aborted || (await this.getInfo())?.iteration !== iteration) { // If aborted, or server is not available or iteration is changed
        ctrl.cleanup?.();
        return;
      }
    }
  }

  /** Send an event to the system */
  async sendEvent<
    V extends CompilerEventType,
    T extends (CompilerEvent & { type: V })['payload']
  >(type: V, payload: T, signal?: AbortSignal): Promise<void> {
    const ctrl = this.#nestedCtrl(signal);
    try {
      const res = await fetch('/send-event', {
        method: 'POST',
        body: JSON.stringify({ type, payload }),
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal
      });
      if (!res.ok) {
        throw new AppError('Unable to send event');
      }
    } finally {
      ctrl.cleanup?.();
    }
  }

  /**
   * Listen to file changes
   * @param signal
   */
  async * listenFileChanges(restartOnExit = false): AsyncIterable<ChangeEvent> {
    let info = await this.getInfo();
    let delay = 1000;
    while (info?.mode !== 'watch') { // If we not are watching from the beginning, wait for the server to change
      await new Promise(r => setTimeout(r, delay)); // Check once a second to see when the compiler comes up
      info = await this.getInfo();
      if (info) {
        return;
      } else {
        delay += 200;
      }
    }

    for await (const ev of this.fetchEvents('change')) {
      yield ev;
    }

    if (restartOnExit) {
      // We are done, request restart
      await ShutdownManager.gracefulShutdown(ExecUtil.RESTART_EXIT_CODE);
    }
  }

  /**
   * On file change
   */
  async onFileChange(handler: Handler, restartOnExit = false): Promise<void> {
    for await (const ev of this.listenFileChanges(restartOnExit)) {
      await handler(ev);
    }
  }
}
