import rl from 'node:readline/promises';
import timers from 'node:timers/promises';
import http, { Agent } from 'node:http';

import { ManifestContext } from '@travetto/manifest';

import type { CompilerEvent, CompilerEventType, CompilerServerInfo, CompilerStateType } from '../types.ts';
import type { LogShape } from '../log.ts';
import { CommonUtil } from '../util.ts';
import { ProcessHandle } from './process-handle.ts';

type FetchEventsConfig<T> = {
  signal?: AbortSignal;
  until?: (event: T) => boolean;
  enforceIteration?: boolean;
};

const streamAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  timeout: 1000 * 60 * 60 * 24
});

/**
 * Compiler Client Operations
 */
export class CompilerClient {

  #url: string;
  #log: LogShape;
  #handle: Record<'compiler' | 'server', ProcessHandle>;

  constructor(ctx: ManifestContext, log: LogShape) {
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

  async #fetch(rel: string, opts?: RequestInit & { timeout?: number }, logTimeout = true): Promise<{ ok: boolean, text: string }> {
    const ctrl = new AbortController();
    const timeoutCtrl = new AbortController();

    opts?.signal?.addEventListener('abort', () => ctrl.abort());
    timers.setTimeout(opts?.timeout ?? 100, undefined, { ref: false, signal: timeoutCtrl.signal })
      .then(() => {
        logTimeout && this.#log.error(`Timeout on request to ${this.#url}${rel}`);
        ctrl.abort('TIMEOUT');
      })
      .catch(() => { });
    const response = await fetch(`${this.#url}${rel}`, { ...opts, signal: ctrl.signal });
    const out = { ok: response.ok, text: await response.text() };
    timeoutCtrl.abort();
    return out;
  }

  /** Get server information, if server is running */
  info(): Promise<CompilerServerInfo | undefined> {
    return this.#fetch('/info', { timeout: 200 }, false).then(v => JSON.parse(v.text), () => undefined);
  }

  async isWatching(): Promise<boolean> {
    return (await this.info())?.state === 'watch-start';
  }

  /** Clean the server */
  clean(): Promise<boolean> {
    return this.#fetch('/clean', { timeout: 300 }).then(v => v.ok, () => false);
  }

  /** Stop server and wait for shutdown */
  async stop(): Promise<boolean> {
    const info = await this.info();
    if (!info) {
      this.#log.debug('Stopping server, info not found, manual killing');
      return Promise.all([this.#handle.server.kill(), this.#handle.compiler.kill()])
        .then(v => v.some(x => x));
    }

    await this.#fetch('/stop').catch(() => { }); // Trigger
    this.#log.debug('Waiting for compiler to exit');
    await this.#handle.compiler.ensureKilled();
    return true;
  }

  /** Fetch compiler events */
  fetchEvents<
    V extends CompilerEventType,
    T extends (CompilerEvent & { type: V })['payload']
  >(type: V, cfg?: FetchEventsConfig<T>): AsyncIterable<T>;
  fetchEvents(type: 'all', cfg?: FetchEventsConfig<CompilerEvent>): AsyncIterable<CompilerEvent>;
  async * fetchEvents<T = unknown>(type: string, cfg: FetchEventsConfig<T> = {}): AsyncIterable<T> {
    let info = await this.info();
    if (!info) {
      return;
    }

    this.#log.debug(`Starting watch for events of type "${type}"`);

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
        const response = await new Promise<http.IncomingMessage>((resolve, reject) =>
          http.get(`${this.#url}/event/${type}`, { agent: streamAgent, signal: ctrl.signal }, resolve)
            .on('error', reject)
        );

        for await (const line of rl.createInterface(response)) {
          if (line.trim().charAt(0) === '{') {
            const event: T = JSON.parse(line);
            if (cfg.until?.(event)) {
              await CommonUtil.queueMacroTask();
              ctrl.abort();
            }
            yield event;
          }
        }
      } catch (error) {
        const aborted = ctrl.signal.aborted || (typeof error === 'object' && error && 'code' in error && error.code === 'ECONNRESET');
        if (!aborted) { throw error; }
      }
      signal.removeEventListener('abort', quit);

      await CommonUtil.queueMacroTask();

      info = await this.info();

      if (ctrl.signal.reason === 'TIMEOUT') {
        this.#log.debug('Failed due to timeout');
        return;
      }

      if (ctrl.signal.aborted || !info || (cfg.enforceIteration && info.iteration !== iteration)) { // If health check fails, or aborted
        this.#log.debug(`Stopping watch for events of type "${type}"`);
        return;
      } else {
        this.#log.debug(`Restarting watch for events of type "${type}"`);
      }
    }
  }

  /** Wait for one of N states to be achieved */
  async waitForState(states: CompilerStateType[], message?: string, signal?: AbortSignal): Promise<void> {
    const set = new Set(states);
    // Loop until
    this.#log.debug(`Waiting for states, ${states.join(', ')}`);
    for await (const _ of this.fetchEvents('state', { signal, until: s => set.has(s.state) })) { }
    this.#log.debug(`Found state, one of ${states.join(', ')} `);
    if (message) {
      this.#log.info(message);
    }
  }
}