import * as vscode from 'vscode';
import { ChildProcess } from 'node:child_process';

import { Env, ExecUtil, JSONUtil, Util } from '@travetto/runtime';

import type { CompilerEvent, CompilerLogEvent, CompilerProgressEvent, CompilerStateEvent, CompilerStateType } from '@travetto/compiler/src/types.ts';

import { BaseFeature } from '../../base.ts';
import { Log } from '../../../core/log.ts';
import { Workspace } from '../../../core/workspace.ts';
import { Activatible } from '../../../core/activation.ts';

type ProgressBar = vscode.Progress<{ message: string, increment?: number }>;
type ProgressState = { previous: number, bar: ProgressBar, cleanup: () => void };

const SCOPE_MAX = 15;
const SUB_LOG_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(.\d{3})?\s+(info|error|debug|warn)/;

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

    const controller = new AbortController();
    const complete = Promise.withResolvers<void>();
    const kill = (): void => controller.abort();
    signal.addEventListener('abort', kill);

    const title = type.charAt(0).toUpperCase() + type.substring(1);

    return this.#progress[type] = {
      previous: 0,
      cleanup: (): void => {
        signal.removeEventListener('abort', kill);
        delete this.#progress[type];
        complete.resolve();
      },
      bar: await new Promise<ProgressBar>(resolve =>
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, cancellable: false, title },
          progress => {
            resolve(progress);
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
    this.#log.trace('Running Compiler', 'trvc', command, args);
    const starting = command === 'start' || command === 'restart';
    this.#started ||= starting;
    const subProcess = Workspace.spawnPackageCommand('trvc', [command, ...args ?? []], {
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

    if (debug && subProcess.stderr) {
      ExecUtil.readLines(subProcess.stderr, line => this.#log.error(`> ${line.trimEnd().replace(SUB_LOG_REGEX, '')}`));
    }

    if (debug && subProcess.stdout) {
      ExecUtil.readLines(subProcess.stdout, line => this.#log.info(`> ${line.trimEnd().replace(SUB_LOG_REGEX, '')}`));
    }

    return subProcess;
  }

  /**
   * Get compiler state
   */
  async #compilerState(): Promise<CompilerStateType | undefined> {
    const { stdout } = await ExecUtil.getResult(this.run('info'));
    try {
      const event: CompilerStateEvent = JSONUtil.parseSafe(stdout);
      return event.state;
    } catch { }
  }

  async #trackConnected(): Promise<void> {
    while (!this.#shuttingDown) {
      const controller = this.#stateController = new AbortController();
      let connected = false;
      let state: string | undefined;
      try {
        state = await this.#compilerState();
        if (state && state !== 'closed') {
          connected = true;
          this.#log.info('Connected', state);
          const subProcess = this.run('event', ['all'], controller.signal);
          await ExecUtil.readLines(subProcess.stdout!, line => {
            const { type, payload }: CompilerEvent = JSONUtil.parseSafe(line);
            switch (type) {
              case 'log': this.#ongLogEvent(payload); break;
              case 'state': this.#onStateEvent(payload); break;
              case 'progress': this.#onProgressEvent(payload, controller.signal); break;
            }
          });
        }
      } catch (error) {
        this.#log.info('Failed to connect', `${error} `);
      }

      if (connected) {
        this.#log.info('Disconnecting', !!controller.signal.aborted, state);
      }

      controller.abort();

      if (Workspace.compilerState !== 'closed') {
        this.#onStateEvent('closed');
      }
      // Check every second
      await Util.nonBlockingTimeout(1000);
    }
  }

  #onStateEvent(event: CompilerStateEvent | CompilerStateType | undefined): void {
    const state = (typeof event === 'string' ? event : event?.state ?? 'closed');

    this.#log.info('Compiler state changed', state);
    let status: string | undefined;
    switch (state) {
      case 'reset': status = '$(flame) Restarting'; break;
      case 'startup':
      case 'init': status = '$(flame) Initializing'; break;
      case 'compile-start': status = '$(flame) Compiling'; break;
      case 'watch-start': status = '$(pass-filled) Ready'; break;
      case 'closed': status = '$(debug-pause) Disconnected'; break;
    }
    this.#status.text = status ?? this.#status.text;
    Workspace.compilerState = state;
  }

  async #ongLogEvent(event: CompilerLogEvent): Promise<void> {
    const message = event.message.replaceAll(Workspace.path, '.');
    let first = message;
    const params = [...event.args ?? []];
    if (event.scope) {
      params.unshift(message);
      first = `[${event.scope.padEnd(SCOPE_MAX, ' ')}]`;
    }
    this.#log[event.level](first, ...params);
  }

  async #onProgressEvent(event: CompilerProgressEvent, signal: AbortSignal): Promise<void> {
    let pState = this.#progress[event.operation];

    const value = 100 * (event.idx / event.total);
    const delta = value - (pState?.previous ?? 0);

    if (event.complete || delta < 0 || event.total < 5) {
      pState?.cleanup();
    } else {
      pState ??= await this.#buildProgressBar(event.operation, signal);
      pState.bar.report({ message: `${Math.trunc(value)}% (Files: ${event.idx + 1}/${event.total})`, increment: delta });
      pState.previous = value;
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
  async activate(_: vscode.ExtensionContext): Promise<void> {
    this.#status.command = { command: this.commandName('status-item'), title: 'Show Logs' };
    this.register('status-item', () => this.#onStatusItemClick());
    this.#onStateEvent('closed');
    this.#status.show();

    this.#trackConnected();
    await Util.nonBlockingTimeout(1000); // Add buffer
    this.run('start');

    for (const operation of ['start', 'stop', 'restart', 'clean'] as const) {
      this.register(operation, () => this.run(operation));
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