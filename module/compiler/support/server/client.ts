import rl from 'node:readline/promises';
import timers from 'node:timers/promises';
import { Readable } from 'node:stream';

import { ManifestContext } from '@travetto/manifest';

import type { CompilerEvent, CompilerEventType, CompilerServerInfo, CompilerStateType } from '../types';
import type { CompilerLogger } from '../log';
import { ProcessHandle } from './process-handle';

type FetchEventsConfig<T> = {
  signal?: AbortSignal;
  until?: (ev: T) => boolean;
  enforceIteration?: boolean;
};

/**
 * Compiler Client Operations
 */
export class CompilerClient {

  #url: string;
  #log: CompilerLogger;
  #handle: Record<'compiler' | 'server', ProcessHandle>;

  constructor(ctx: ManifestContext, log: CompilerLogger) {
    this.#url = ctx.build.compilerUrl.replace('localhost', '127.0.0.1');
    this.#log = log;
    this.#handle = { compiler: new ProcessHandle(ctx, 'compiler'), server: new ProcessHandle(ctx, 'server') };
  }

  toString(): string {
    return `[${this.constructor.name} url=${this.#url}]`;
  }

  get url(): string {
    return this.#url;
  }

  async #fetch(rel: string, opts?: RequestInit & { timeout?: number }, logTimeout = true): Promise<Response> {
    const ctrl = new AbortController();
    opts?.signal?.addEventListener('abort', () => ctrl.abort());
    const timeoutId = setTimeout(() => {
      logTimeout && this.#log('error', `Timeout on request to ${this.#url}${rel}`);
      ctrl.abort('TIMEOUT');
    }, 100).unref();
    try {
      return await fetch(`${this.#url}${rel}`, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Get server information, if server is running */
  info(): Promise<CompilerServerInfo | undefined> {
    return this.#fetch('/info', {}, false).then(v => v.json(), () => undefined)
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .then(v => v as CompilerServerInfo);
  }

  async isWatching(): Promise<boolean> {
    return (await this.info())?.state === 'watch-start';
  }

  /** Clean the server */
  clean(): Promise<boolean> {
    return this.#fetch('/clean').then(v => v.ok, () => false);
  }

  /** Stop server and wait for shutdown */
  async stop(): Promise<boolean> {
    const info = await this.info();
    if (!info) {
      this.#log('debug', 'Stopping server, info not found, manual killing');
      return Promise.all([this.#handle.server.kill(), this.#handle.compiler.kill()])
        .then(v => v.some(x => x));
    }

    await this.#fetch('/stop').catch(() => { }); // Trigger
    this.#log('debug', 'Waiting for compiler to exit');
    await this.#handle.compiler.ensureKilled();
    return true;
  }

  /** Fetch compiler events */
  async * fetchEvents<
    V extends CompilerEventType,
    T extends (CompilerEvent & { type: V })['payload']
  >(type: V, cfg: FetchEventsConfig<T> = {}): AsyncIterable<T> {
    let info = await this.info();
    if (!info) {
      return;
    }

    this.#log('debug', `Starting watch for events of type "${type}"`);

    let signal = cfg.signal;

    // Ensure we capture end of process at least
    if (!signal) {
      const ctrl = new AbortController();
      process.on('SIGINT', () => ctrl.abort());
      signal = ctrl.signal;
    }

    const { iteration } = info;

    for (; ;) {
      const ctrl = new AbortController();
      const quit = (): void => ctrl.abort();
      try {
        signal.addEventListener('abort', quit);
        const stream = await this.#fetch(`/event/${type}`, { signal: ctrl.signal, keepalive: true });

        for await (const line of rl.createInterface(Readable.fromWeb(stream.body!))) {
          if (line.trim().charAt(0) === '{') {
            const val = JSON.parse(line);
            if (cfg.until?.(val)) {
              await timers.setTimeout(1);
              ctrl.abort();
            }
            yield val;
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) { throw err; }
      }
      signal.removeEventListener('abort', quit);

      await timers.setTimeout(1);

      info = await this.info();

      if (ctrl.signal.reason === 'TIMEOUT') {
        this.#log('debug', 'Failed due to timeout');
        return;
      }

      if (ctrl.signal.aborted || !info || (cfg.enforceIteration && info.iteration !== iteration)) { // If health check fails, or aborted
        this.#log('debug', `Stopping watch for events of type "${type}"`);
        return;
      } else {
        this.#log('debug', `Restarting watch for events of type "${type}"`);
      }
    }
  }

  /** Wait for one of N states to be achieved */
  async waitForState(states: CompilerStateType[], message?: string, signal?: AbortSignal): Promise<void> {
    const set = new Set(states);
    // Loop until
    this.#log('debug', `Waiting for states, ${states.join(', ')}`);
    for await (const _ of this.fetchEvents('state', { signal, until: s => set.has(s.state) })) { }
    this.#log('debug', `Found state, one of ${states.join(', ')} `);
    if (message) {
      this.#log('info', message);
    }
  }
}