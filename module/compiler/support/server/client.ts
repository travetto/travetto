import rl from 'node:readline/promises';
import timers from 'node:timers/promises';
import { Readable } from 'node:stream';

import { ManifestContext } from '@travetto/manifest';

import type {
  CompilerProgressEvent, CompilerServerEvent, CompilerServerEventType, CompilerServerInfo, CompilerStateType
} from '../types';

import { LogUtil } from '../log';

declare global {
  interface RequestInit { timeout?: number }
}

const log = LogUtil.log.bind(LogUtil, 'compiler-client');

function getSignal(input?: AbortSignal): AbortSignal {
  // Ensure we capture end of process at least
  if (!input) {
    const ctrl = new AbortController();
    process.on('SIGINT', () => ctrl.abort());
    input = ctrl.signal;
  }
  return input;
}

/**
 * Compiler Client Operations
 */
export class CompilerClient {
  /**
   * Get progress writer
   * @returns
   */
  static progressWriter(): ((ev: CompilerProgressEvent) => Promise<void> | void) | undefined {
    const out = process.stdout;
    if (!LogUtil.isLevelActive('info') || !out.isTTY) {
      return;
    }

    return (ev: CompilerProgressEvent): Promise<void> | void => {
      const pct = Math.trunc(ev.idx * 100 / ev.total);
      const text = ev.complete ? '' : `Compiling [${'#'.repeat(Math.trunc(pct / 10)).padEnd(10, ' ')}] [${ev.idx}/${ev.total}] ${ev.message}`;
      // Move to 1st position, and clear after text
      const done = out.write(`\x1b[1G${text}\x1b[0K`);
      if (!done) {
        return new Promise<void>(r => out.once('drain', r));
      }
    };
  }

  #url: string;
  constructor(url: string | ManifestContext) {
    this.#url = (typeof url === 'string' ? url : url.build.compilerUrl).replace('localhost', '127.0.0.1');
  }

  get url(): string {
    return this.#url;
  }

  /**
   * Track compiler progress
   */
  async trackProgress(signal?: AbortSignal): Promise<void> {
    const writer = CompilerClient.progressWriter();
    if (!writer) {
      return;
    }

    const src = this.fetchEvents('progress', signal, ev => !!ev.complete);

    for await (const x of src) {
      await writer(x);
    }
  }

  /**
   * Get server information, if server is running
   */
  info(): Promise<CompilerServerInfo | undefined> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return fetch(`${this.#url}/info`).then(v => v.json(), () => undefined) as Promise<CompilerServerInfo>;
  }

  /**
   * Clean the server
   */
  clean(): Promise<boolean> {
    return fetch(`${this.#url}/clean`).then(v => v.ok, () => false);
  }

  /**
   * Stop server
   */
  stop(): Promise<boolean> {
    return fetch(`${this.#url}/stop`).then(v => v.ok, () => false);
  }

  /**
   * Fetch compiler events
   */
  async * fetchEvents<
    V extends CompilerServerEventType,
    T extends (CompilerServerEvent & { type: V })['payload']
  >(type: V, signal?: AbortSignal, until?: (ev: T) => boolean): AsyncIterable<T> {
    log('debug', `Starting watch for events of type "${type}"`);

    signal = getSignal(signal);

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
            if (until?.(val)) {
              await timers.setTimeout(1);
              ctrl.abort();
            }
            yield val;
          }
        }
      } catch (err) { }

      await timers.setTimeout(1);

      if (ctrl.signal.aborted || !(await this.info())) { // If health check fails, or aborted
        log('debug', `Stopping watch for events of type "${type}"`);
        return;
      } else {
        log('debug', `Restarting watch for events of type "${type}"`);
      }
    }
  }

  /**
   * Wait for one of N states to be achieved
   */
  async waitForState(states: CompilerStateType[], signal?: AbortSignal): Promise<void> {
    const set = new Set(states);
    const existing = await this.info();
    log('debug', `Existing: ${JSON.stringify(existing)}`);
    if (existing && set.has(existing.state)) {
      log('debug', `Waited for state, ${existing.state} in server info`);
      return;
    }
    // Loop until
    log('debug', `Waiting for states, ${states.join(', ')}`);
    for await (const _ of this.fetchEvents('state', signal, s => set.has(s.state))) { }
    log('debug', `Found state, one of ${states.join(', ')} `);
  }

  /**
   * Stream logs
   */
  async streamLogs(signal?: AbortSignal): Promise<void> {
    if (!LogUtil.logLevel) {
      return;
    }
    for await (const ev of this.fetchEvents('log', signal!)) {
      LogUtil.sendLogEventToConsole(ev);
    }
  }

  /**
   * Wait for build
   */
  async waitForBuild(signal?: AbortSignal): Promise<void> {
    this.trackProgress(signal);
    await this.waitForState(['compile-end', 'watch-start'], signal);
    log('info', 'Successfully built');
  }
}