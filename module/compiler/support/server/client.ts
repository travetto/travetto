import rl from 'node:readline/promises';
import { Readable } from 'node:stream';

import type { ManifestContext } from '@travetto/manifest';
import type { CompilerServerEvent, CompilerServerEventType, CompilerServerInfo, CompilerStateType } from '../types';

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
              setTimeout(() => ctrl.abort(), 1);
            }
            yield val;
          }
        }
      } catch (err) { }

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
    log('debug', `Found state, one of ${states.join(', ')}`);
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
    await this.waitForState(ctx, ['compile-end', 'watch-start'], signal);
    log('info', 'Successfully built');
  }
}