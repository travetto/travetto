import rl from 'node:readline/promises';
import timers from 'node:timers/promises';
import { Readable } from 'node:stream';

import type { ManifestContext } from '@travetto/manifest';
import type { CompilerProgressEvent, CompilerServerEvent, CompilerServerEventType, CompilerServerInfo, CompilerStateType } from '../types';

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
export class CompilerClientUtil {

  /**
   * Get progress writer
   * @returns
   */
  static progressWriter(): ((ev: CompilerProgressEvent) => Promise<void>) | undefined {
    if (!LogUtil.isLevelActive('info')) {
      return;
    }
    const out = process.stdout;

    let message: string | undefined;

    return async (ev: CompilerProgressEvent): Promise<void> => {
      if (message) {
        await new Promise<void>(r => out.clearLine?.(0, () => out?.moveCursor(-message!.length, 0, () => r())) ?? r());
      }
      if (!ev.complete) {
        const pct = Math.trunc(ev.idx * 100 / ev.total);
        message = `Compiling [${'#'.repeat(Math.trunc(pct / 10)).padEnd(10, ' ')}] [${ev.idx}/${ev.total}] ${ev.message}`;
        await new Promise<void>(r => out.write(message!, () => r()));
      }
    };
  }

  /**
   * Track compiler progress
   */
  static async trackProgress(ctx: ManifestContext, signal?: AbortSignal): Promise<void> {
    const writer = this.progressWriter();
    if (!writer) {
      return;
    }

    const src = this.fetchEvents(ctx, 'progress', signal, ev => !!ev.complete);

    for await (const x of src) {
      await writer(x);
    }
  }

  /**
   * Get server information, if server is running
   */
  static async getServerInfo(ctx: ManifestContext): Promise<CompilerServerInfo | undefined> {
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const res = (await fetch(`${ctx.compilerUrl}/info`).then(v => v.json())) as CompilerServerInfo;
      return res;
    } catch (err) {
      return undefined;
    }
  }

  /**
   * Fetch compiler events
   */
  static async * fetchEvents<
    V extends CompilerServerEventType,
    T extends (CompilerServerEvent & { type: V })['payload']
  >(ctx: ManifestContext, type: V, signal?: AbortSignal, until?: (ev: T) => boolean): AsyncIterable<T> {
    log('debug', `Starting watch for events of type "${type}"`);

    signal = getSignal(signal);

    for (; ;) {
      const ctrl = new AbortController();
      try {
        signal.addEventListener('abort', () => ctrl.abort());
        const stream = await fetch(`${ctx.compilerUrl}/event/${type}`, {
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

      if (ctrl.signal.aborted || !(await this.getServerInfo(ctx))) { // If health check fails, or aborted
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
  static async waitForState(ctx: ManifestContext, states: CompilerStateType[], signal?: AbortSignal): Promise<void> {
    const set = new Set(states);
    const existing = await this.getServerInfo(ctx);
    log('debug', `Existing: ${JSON.stringify(existing)}`);
    if (existing && set.has(existing.state)) {
      log('debug', `Waited for state, ${existing.state} in server info`);
      return;
    }
    // Loop until
    log('debug', `Waiting for states, ${states.join(', ')}`);
    for await (const _ of this.fetchEvents(ctx, 'state', signal, s => set.has(s.state))) { }
    log('debug', `Found state, one of ${states.join(', ')} `);
  }

  /**
   * Stream logs
   */
  static async streamLogs(ctx: ManifestContext, signal?: AbortSignal): Promise<void> {
    if (!LogUtil.logLevel) {
      return;
    }
    for await (const ev of this.fetchEvents(ctx, 'log', signal!)) {
      LogUtil.sendLogEventToConsole(ev);
    }
  }

  /**
   * Wait for build
   */
  static async waitForBuild(ctx: ManifestContext, signal?: AbortSignal): Promise<void> {
    this.trackProgress(ctx, signal);
    await this.waitForState(ctx, ['compile-end', 'watch-start'], signal);
    log('info', 'Successfully built');
  }
}