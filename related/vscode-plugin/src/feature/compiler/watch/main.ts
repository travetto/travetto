import vscode from 'vscode';
import { createInterface } from 'node:readline/promises';
import timers from 'node:timers/promises';
import { ChildProcess, spawn } from 'node:child_process';

import type { CompilerLogEvent, CompilerProgressEvent, CompilerStateEvent, CompilerStateType } from '@travetto/compiler/support/types';
import { Env, ExecUtil, StreamUtil, Util } from '@travetto/base';

import { BaseFeature } from '../../base';
import { Log } from '../../../core/log';
import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';

type ProgressBar = vscode.Progress<{ message: string, increment?: number }>;
type ProgressState = { prev: number, bar: ProgressBar, cleanup: () => void };

const SCOPE_MAX = 15;
const SUB_LOG_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(.\d{3})?\s+(info|error|debug|warn)/;

/**
 * Workspace Compilation Support
 */
@Activatible('@travetto/compiler', true, 1)
export class CompilerWatchFeature extends BaseFeature {
  #status = vscode.window.createStatusBarItem('travetto.build', vscode.StatusBarAlignment.Left, 1000);
  #log = new Log('travetto.compiler');
  #progress: Record<string, ProgressState> = {};

  async #buildProgressBar(type: string, signal: AbortSignal): Promise<ProgressState> {
    this.#progress[type]?.cleanup();

    const ctrl = new AbortController();
    const complete = Util.resolvablePromise();
    const kill = (): void => ctrl.abort();
    signal.addEventListener('abort', kill);

    const title = type.charAt(0).toUpperCase() + type.substring(1);

    return this.#progress[type] = {
      prev: 0,
      cleanup: (): void => {
        signal.removeEventListener('abort', kill);
        delete this.#progress[type];
        complete.resolve();
      },
      bar: await new Promise<ProgressBar>(resolve =>
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, cancellable: false, title },
          p => {
            resolve(p);
            return complete;
          }
        )
      )
    };
  }

  /**
   * Spawn the compiler cli
   * @param command
   */
  run(command: 'start' | 'stop' | 'clean' | 'restart' | 'info' | 'event', args?: string[], signal?: AbortSignal): ChildProcess {
    const debug = command !== 'info' && command !== 'event';
    this.#log.trace('Running Compiler', 'npx', 'trvc', command, args);
    const proc = spawn('npx', ['trvc', command, ...args ?? []], {
      cwd: Workspace.path,
      signal,
      stdio: (command === 'start' || command === 'restart') ? ['pipe', 'ignore', 'pipe'] : 'pipe',
      env: {
        PATH: process.env.PATH,
        ...(debug ? Env.TRV_BUILD.export('debug') : {})
      }
    }).on('exit', (code) => {
      this.#log.debug('Finished command', command, 'with', code);
    });

    debug && proc.stderr && StreamUtil.onLine(proc.stderr, line => this.#log.error(`> ${line.replace(SUB_LOG_RE, '')}`));
    debug && proc.stdout && StreamUtil.onLine(proc.stdout, line => this.#log.info(`> ${line.replace(SUB_LOG_RE, '')}`));

    return proc;
  }

  /**
   * Spawn the compiler cli and listen for events
   * @param type
   * @param signal
   */
  async * #compilerEvents<T>(type: 'state' | 'log' | 'progress', signal?: AbortSignal): AsyncIterable<T> {
    const proc = this.run('event', [type], signal);
    for await (const line of createInterface(proc.stdout!)) {
      yield JSON.parse(line);
    }
  }

  /**
   * Get compiler state
   */
  async #compilerState(): Promise<CompilerStateType | undefined> {
    const { stdout } = await ExecUtil.getResult(this.run('info'));
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(stdout).state as CompilerStateType;
    } catch { }
  }

  async #trackConnected(): Promise<void> {
    for (; ;) {
      const ctrl = new AbortController();
      let connected = false;
      let state: string | undefined;
      try {
        state = await this.#compilerState();
        if (state && state !== 'closed') {
          connected = true;
          this.#log.info('Connected', state);
          await Promise.race([this.#trackLog(ctrl.signal), this.#trackState(ctrl.signal), this.#trackProgress(ctrl.signal)]);
        }
      } catch (err) {
        this.#log.info('Failed to connect', `${err} `);
      }

      if (connected) {
        this.#log.info('Disconnecting', !!ctrl.signal.aborted, state);
      }

      ctrl.abort();

      if (Workspace.compilerState !== 'closed') {
        this.#onState('closed');
      }
      // Check every second
      await timers.setTimeout(1000, undefined, { ref: false });
    }
  }

  #onState(state: CompilerStateType | undefined): void {
    state ??= 'closed';
    this.#log.info('Compiler state changed', state);
    let v: string | undefined;
    switch (state) {
      case 'reset': v = '$(flame) Restarting'; break;
      case 'startup':
      case 'init': v = '$(flame) Initializing'; break;
      case 'compile-start': v = '$(flame) Compiling'; break;
      case 'watch-start': v = '$(pass-filled) Ready'; break;
      case 'closed': v = '$(debug-pause) Disconnected'; break;
    }
    this.#status.text = v ?? this.#status.text;
    Workspace.compilerState = state;
  }

  async #trackState(signal?: AbortSignal): Promise<void> {
    this.#log.info('Tracking state started');
    for await (const ev of this.#compilerEvents<CompilerStateEvent>('state', signal)) {
      this.#onState(ev.state);
    }
    this.#log.info('Tracking state ended');
  }

  async #trackLog(signal?: AbortSignal): Promise<void> {
    this.#log.info('Tracking log started');
    for await (const ev of this.#compilerEvents<CompilerLogEvent>('log', signal)) {
      const message = ev.message.replaceAll(Workspace.path, '.');
      let first = message;
      const params = [...ev.args ?? []];
      if (ev.scope) {
        params.unshift(message);
        first = `[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`;
      }
      this.#log[ev.level](first, ...params);
    }
    this.#log.info('Tracking log ended');
  }

  async #trackProgress(signal: AbortSignal): Promise<void> {
    this.#log.info('Tracking progress started');
    for await (const ev of this.#compilerEvents<CompilerProgressEvent>('progress')) {
      let pState = this.#progress[ev.operation];

      const value = 100 * (ev.idx / ev.total);
      const delta = value - (pState?.prev ?? 0);

      if (ev.complete || delta < 0 || ev.total < 5) {
        pState?.cleanup();
        continue;
      }

      pState ??= await this.#buildProgressBar(ev.operation, signal);
      pState.bar.report({ message: `${Math.trunc(value)}% (Files: ${ev.idx + 1}/${ev.total})`, increment: delta });
      pState.prev = value;
    }
    this.#log.info('Tracking progress ended');
  }

  async #onStatusItemClick(): Promise<void> {
    if (Workspace.compilerState === 'closed') {
      this.run('start');
    }
    this.#log.show();
  }

  /**
   * On initial activation
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    this.#status.command = { command: this.commandName('status-item'), title: 'Show Logs' };
    this.register('status-item', () => this.#onStatusItemClick());
    this.#onState('closed');
    this.#status.show();

    this.#trackConnected();
    await timers.setTimeout(1000, undefined, { ref: false }); // Add buffer
    this.run('start');

    for (const op of ['start', 'stop', 'restart', 'clean'] as const) {
      this.register(op, () => this.run(op));
    }
  }
}