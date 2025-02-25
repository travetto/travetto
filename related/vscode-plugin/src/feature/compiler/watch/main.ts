import vscode from 'vscode';
import { ChildProcess, spawn } from 'node:child_process';

import type { CompilerEvent, CompilerLogEvent, CompilerProgressEvent, CompilerStateEvent, CompilerStateType } from '@travetto/compiler/support/types';
import { Env, ExecUtil, Util } from '@travetto/runtime';

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
  #stateController?: AbortController;
  #shuttingDown = false;
  #started = false;

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
            return complete.promise;
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
    const starting = command === 'start' || command === 'restart';
    this.#started ||= starting;
    const proc = spawn('npx', ['trvc', command, ...args ?? []], {
      cwd: Workspace.path,
      signal,
      stdio: ['pipe', starting ? 'ignore' : 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        ...(debug ? Env.TRV_BUILD.export('debug') : {})
      }
    }).on('exit', (code) => {
      this.#started &&= !starting;
      this.#log.debug('Finished command', command, 'with', code);
    });

    if (debug && proc.stderr) {
      ExecUtil.readLines(proc.stderr, line => this.#log.error(`> ${line.trimEnd().replace(SUB_LOG_RE, '')}`));
    }

    if (debug && proc.stdout) {
      ExecUtil.readLines(proc.stdout, line => this.#log.info(`> ${line.trimEnd().replace(SUB_LOG_RE, '')}`));
    }

    return proc;
  }

  /**
   * Get compiler state
   */
  async #compilerState(): Promise<CompilerStateType | undefined> {
    const { stdout } = await ExecUtil.getResult(this.run('info'));
    try {
      const res: CompilerStateEvent = JSON.parse(stdout);
      return res.state;
    } catch { }
  }

  async #trackConnected(): Promise<void> {
    while (!this.#shuttingDown) {
      const ctrl = this.#stateController = new AbortController();
      let connected = false;
      let state: string | undefined;
      try {
        state = await this.#compilerState();
        if (state && state !== 'closed') {
          connected = true;
          this.#log.info('Connected', state);
          const proc = this.run('event', ['all'], ctrl.signal);
          await ExecUtil.readLines(proc.stdout!, line => {
            const { type, payload }: CompilerEvent = JSON.parse(line);
            switch (type) {
              case 'log': this.#ongLogEvent(payload); break;
              case 'state': this.#onStateEvent(payload); break;
              case 'progress': this.#onProgressEvent(payload, ctrl.signal); break;
            }
          });
        }
      } catch (err) {
        this.#log.info('Failed to connect', `${err} `);
      }

      if (connected) {
        this.#log.info('Disconnecting', !!ctrl.signal.aborted, state);
      }

      ctrl.abort();

      if (Workspace.compilerState !== 'closed') {
        this.#onStateEvent('closed');
      }
      // Check every second
      await Util.nonBlockingTimeout(1000);
    }
  }

  #onStateEvent(ev: CompilerStateEvent | CompilerStateType | undefined): void {
    const state = (typeof ev === 'string' ? ev : ev?.state ?? 'closed');

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

  async #ongLogEvent(ev: CompilerLogEvent): Promise<void> {
    const message = ev.message.replaceAll(Workspace.path, '.');
    let first = message;
    const params = [...ev.args ?? []];
    if (ev.scope) {
      params.unshift(message);
      first = `[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`;
    }
    this.#log[ev.level](first, ...params);
  }

  async #onProgressEvent(ev: CompilerProgressEvent, signal: AbortSignal): Promise<void> {
    let pState = this.#progress[ev.operation];

    const value = 100 * (ev.idx / ev.total);
    const delta = value - (pState?.prev ?? 0);

    if (ev.complete || delta < 0 || ev.total < 5) {
      pState?.cleanup();
    } else {
      pState ??= await this.#buildProgressBar(ev.operation, signal);
      pState.bar.report({ message: `${Math.trunc(value)}% (Files: ${ev.idx + 1}/${ev.total})`, increment: delta });
      pState.prev = value;
    }
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
    this.#onStateEvent('closed');
    this.#status.show();

    this.#trackConnected();
    await Util.nonBlockingTimeout(1000); // Add buffer
    this.run('start');

    for (const op of ['start', 'stop', 'restart', 'clean'] as const) {
      this.register(op, () => this.run(op));
    }
  }

  async deactivate(): Promise<void> {
    this.#shuttingDown = true;
    if (this.#started) {
      this.run('stop');
    }
    this.#stateController?.abort();
  }
}