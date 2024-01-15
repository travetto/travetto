import vscode from 'vscode';
import { createInterface } from 'node:readline/promises';
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

/**
 * Workspace Compilation Support
 */
@Activatible('@travetto/compiler', true, 1)
export class CompilerWatchFeature extends BaseFeature {
  #status = vscode.window.createStatusBarItem('travetto.build', vscode.StatusBarAlignment.Left, 1000);
  #log = new Log('travetto.compiler');
  #progress: Record<string, ProgressState> = {};
  #compilerCliFile!: string;

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
    this.#log.debug('Running Compiler', this.#compilerCliFile, command);
    const proc = spawn('node', [this.#compilerCliFile, command, ...args ?? []], {
      cwd: Workspace.path,
      signal,
      shell: false,
      env: {
        PATH: process.env.PATH,
        ...(command !== 'info' && command !== 'event') ? Env.TRV_BUILD.export('debug') : {}
      }
    });

    if (command === 'start' || command === 'restart') {
      StreamUtil.onLine(proc.stderr, line => this.#log.error(`> ${line}`));
    }

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
      try {
        if (await this.#compilerState()) {
          connected = true;

          await Promise.race([this.#trackLog(), this.#trackState(), this.#trackProgress(ctrl.signal)]);
        }
      } catch (err) {
        this.#log.info('Failed to connect', `${err}`);
      }

      if (connected) {
        this.#log.info('Disconnecting', !!ctrl.signal.aborted);
      }
      ctrl.abort();
      // Check every second
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  #onState(state: CompilerStateType): void {
    let v: string;
    switch (state) {
      case 'reset': v = '$(flame) Restarting'; break;
      case 'startup':
      case 'init': v = '$(flame) Initializing'; break;
      case 'compile-start': v = '$(flame) Compiling'; break;
      case 'compile-end':
      case 'watch-start': v = '$(pass-filled) Ready'; break;
      case 'watch-end':
      case 'close':
      default: v = '$(debug-pause) Disconnected'; break;
    }
    this.#status.text = v;
    Workspace.compilerState = state;
  }

  async #trackState(): Promise<void> {
    try {
      const state = await this.#compilerState();
      this.#onState(state!);
      for await (const ev of this.#compilerEvents<CompilerStateEvent>('state')) {
        this.#onState(ev.state);
      }
    } finally {
      this.#onState('close');
    }
  }

  async #trackLog(): Promise<void> {
    for await (const ev of this.#compilerEvents<CompilerLogEvent>('log')) {
      const message = ev.message.replaceAll(Workspace.path, '.');
      let first = message;
      const params = [...ev.args ?? []];
      if (ev.scope) {
        params.unshift(message);
        first = `[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`;
      }
      this.#log[ev.level](first, ...params);
    }
  }

  async #trackProgress(signal: AbortSignal): Promise<void> {
    for await (const ev of this.#compilerEvents<CompilerProgressEvent>('progress')) {
      let pState = this.#progress[ev.operation];

      const value = 100 * (ev.idx / ev.total);
      const delta = (value - pState?.prev ?? 0);

      if (ev.complete || delta < 0) {
        pState?.cleanup();
        continue;
      }

      pState ??= await this.#buildProgressBar(ev.operation, signal);
      pState.bar.report({ message: `${Math.trunc(value)}% (Files: ${ev.idx + 1}/${ev.total})`, increment: delta });
      pState.prev = value;
    }
  }

  /**
   * On initial activation
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    this.#status.command = { command: this.commandName('show-log'), title: 'Show Logs' };
    this.#onState('close');

    this.#compilerCliFile = Workspace.resolveImport('@travetto/compiler/bin/trvc.js');

    // Start the listener
    this.#trackConnected();

    this.run('start');

    for (const op of ['start', 'stop', 'restart', 'clean'] as const) {
      this.register(op, () => this.run(op));
    }

    this.register('show-log', () => this.#log.show());

    this.#status.show();
  }
}