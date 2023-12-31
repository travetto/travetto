import rl from 'node:readline/promises';
import timers from 'node:timers/promises';
import { Readable } from 'node:stream';

import { ManifestContext } from '@travetto/manifest';

import type { CompilerEvent, CompilerEventType, CompilerServerInfo, CompilerStateType } from '../types';
import type { CompilerLogger } from '../log';

declare global {
  interface RequestInit { timeout?: number }
}

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
  #log?: CompilerLogger;

  constructor(ctx: ManifestContext, log?: CompilerLogger) {
    this.#url = ctx.build.compilerUrl.replace('localhost', '127.0.0.1');
    this.#log = log;
  }

  toString(): string {
    return `[${this.constructor.name} url=${this.#url}]`;
  }

  get url(): string {
    return this.#url;
  }

  /** Get server information, if server is running */
  info(): Promise<CompilerServerInfo | undefined> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return fetch(`${this.#url}/info`).then(v => v.json(), () => undefined) as Promise<CompilerServerInfo>;
  }

  /** Clean the server */
  clean(): Promise<boolean> {
    return fetch(`${this.#url}/clean`).then(v => v.ok, () => false);
  }

  /** Stop server */
  stop(): Promise<boolean> {
    return fetch(`${this.#url}/stop`).then(v => v.ok, () => false);
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

    this.#log?.('debug', `Starting watch for events of type "${type}"`);

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
      try {
        signal.addEventListener('abort', () => ctrl.abort());
        const stream = await fetch(`${this.#url}/event/${type}`, {
          signal: ctrl.signal,
          timeout: 1000 * 60 * 60
        });
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
      } catch (err) { }

      await timers.setTimeout(1);

      info = await this.info();

      if (ctrl.signal.aborted || !info || (cfg.enforceIteration && info.iteration !== iteration)) { // If health check fails, or aborted
        this.#log?.('debug', `Stopping watch for events of type "${type}"`);
        return;
      } else {
        this.#log?.('debug', `Restarting watch for events of type "${type}"`);
      }
    }
  }

  /** Wait for one of N states to be achieved */
  async waitForState(states: CompilerStateType[], message?: string, signal?: AbortSignal): Promise<void> {
    const set = new Set(states);
    const existing = await this.info();
    this.#log?.('debug', `Existing: ${JSON.stringify(existing)}`);
    if (existing && set.has(existing.state)) {
      this.#log?.('debug', `Waited for state, ${existing.state} in server info`);
      return;
    }
    // Loop until
    this.#log?.('debug', `Waiting for states, ${states.join(', ')}`);
    for await (const _ of this.fetchEvents('state', { signal, until: s => set.has(s.state) })) { }
    this.#log?.('debug', `Found state, one of ${states.join(', ')} `);
    if (message) {
      this.#log?.('info', message);
    }
  }
}