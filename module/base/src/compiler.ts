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

type ChangeEvent = { action: 'create' | 'update' | 'delete'; file: string; folder: string; output: string; module: string; time: number; };
type ProgressEvent = { idx: number, total: number, message: string, operation: string, complete?: boolean };
type StateEvent = { state: ServerInfo['state'] };
type LogEvent = { level: LogLevel, message: string, args: string[], scope: string, time: number };

type CompilerEvent =
  { type: 'change', payload: ChangeEvent } |
  { type: 'log', payload: LogEvent } |
  { type: 'progress', payload: ProgressEvent } |
  { type: 'state', payload: StateEvent } |
  { type: 'custom', payload: any };

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
      cfg.signal.addEventListener('abort', () => this.#kill.abort());
    }
    ShutdownManager.onExitRequested(() => this.#kill.abort());
  }

  replaceSignal(signal: AbortSignal) {
    this.#kill = new AbortController();
    signal.addEventListener('abort', () => this.#kill.abort());
  }

  close() {
    this.#kill.abort();
  }

  /** Get compiler info */
  async getInfo(env?: boolean): Promise<ServerInfo | undefined> {
    const res = await fetch(`${this.#url}/info?${env ? 'env' : ''}`, { signal: this.#kill.signal }).catch(err => ({ ok: false, json: () => undefined }));
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (await res.json()) as ServerInfo;
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

    const { iteration } = info;
    for (; ;) {
      try {
        const stream = await fetch(`${this.#url}/event/${type}`, { signal: signal ?? this.#kill.signal });
        for await (const line of rl.createInterface(Readable.fromWeb(stream.body!))) {
          if (line.trim().charAt(0) === '{') {
            yield JSON.parse(line);
          }
        }
      } catch (err) { }

      if (this.#kill.signal?.aborted || (await this.getInfo())?.iteration !== iteration) { // If aborted, or server is not available or iteration is changed
        return;
      }
    }
  }

  /** Send an event to the system */
  async sendEvent<
    V extends CompilerEventType,
    T extends (CompilerEvent & { type: V })['payload']
  >(type: V, payload: T, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`${this.#url}/send-event`, {
      method: 'POST',
      body: JSON.stringify({ type, payload }),
      headers: { 'Content-Type': 'application/json' },
      signal
    });
    if (!res.ok) {
      throw new AppError('Unable to send event');
    }
  }

  /**
   * Listen to file changes
   * @param signal
   */
  async * listenFileChanges(restartOnExit = false): AsyncIterable<ChangeEvent> {

    let info = await this.getInfo();
    while (info?.mode !== 'watch') { // If we not are watching from the beginning, wait for the server to change
      await new Promise(r => setTimeout(r, 1000)); // Check once a second to see when the compiler comes up
      info = await this.getInfo();
      if (info) {
        return;
      }
    }

    for await (const ev of this.fetchEvents('change')) {
      yield ev;
    }

    if (restartOnExit) {
      // We are done, request restart
      process.exit(ExecUtil.RESTART_EXIT_CODE);
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
