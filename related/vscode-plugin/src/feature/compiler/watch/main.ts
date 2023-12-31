import vscode from 'vscode';

import type { CompilerLogEvent, CompilerProgressEvent, CompilerStateEvent } from '@travetto/compiler/support/types';
import { Env, ExecUtil, ExecutionState } from '@travetto/base';

import { BaseFeature } from '../../base';
import { Log } from '../../../core/log';
import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { AsyncQueue, resolvablePromise } from '../../../core/queue';

type ProgressBar = vscode.Progress<{ message: string, increment?: number }>;
type ProgressState = { prev: number, bar: ProgressBar, cleanup: () => void };
type CompilerState = CompilerStateEvent['state'];

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
    const complete = resolvablePromise();
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
   * Spawn the compiler cli in the same form as ExecUtil.spawn
   * @param command
   */
  run(command: 'start' | 'stop' | 'clean' | 'restart' | 'info'): ExecutionState {
    this.#log.debug('Running Compiler', this.#compilerCliFile, command);
    return ExecUtil.spawn('node', [this.#compilerCliFile, command], {
      cwd: Workspace.path,
      isolatedEnv: true,
      ...((command === 'start' || command === 'restart') ? {
        outputMode: 'text-stream',
        onStdErrorLine: line => this.#log.error(`> ${line}`),
      } : {}),
      env: { ...Env.TRV_BUILD.export('debug') }
    });
  }

  /**
   * Spawn the compiler cli and listen for events
   * @param type
   * @param signal
   */
  #compilerEvents<T>(type: 'state' | 'log' | 'progress', signal?: AbortSignal): AsyncIterable<T> {
    const queue = new AsyncQueue<T>(signal);
    const { process: proc } = ExecUtil.spawn('node', [this.#compilerCliFile, 'event', type], {
      cwd: Workspace.path, outputMode: 'text-stream', isolatedEnv: true,
      onStdOutLine: line => queue.add(JSON.parse(line)),
    });

    signal?.addEventListener('abort', () => proc.kill());
    proc.on('exit', () => queue.close());
    return queue;
  }

  /**
   * Get compiler state
   */
  async #compilerState(): Promise<CompilerState | undefined> {
    const result = await this.run('info').result;
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(result.stdout).state as CompilerState;
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
        } else {
          this.#log.debug('Server not running');
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

  #onState(state: CompilerState): void {
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