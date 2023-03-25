import vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { ProcessServer } from '../../../core/server';
import { BuildStatus } from '../../../core/build';
import { Workspace } from '../../../core/workspace';

import { BaseFeature } from '../../base';

/**
 * Workspace Compilation Support
 */
@Activatible('@travetto/compiler', true)
export class CompilerWatchFeature extends BaseFeature {

  server: ProcessServer<{ type: '' }, { type: 'status', total: number, idx: number } | { type: 'start' | 'complete' }>;

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    this.register('start', () => this.server.restart(true));
    this.register('stop', () => this.server.stop(true));
    this.register('clean', () => Workspace.spawnCli('clean', []).result);
    this.register('clean-all', () => Workspace.spawnCli('clean', ['-a']).result);

    BuildStatus.onBuildWaiting(() => this.server.start());

    let prog: vscode.Progress<{ message: string, increment?: number }> | undefined;
    let prom = Workspace.manualPromise<void>();
    let prev = 0;

    this.server = new ProcessServer(this.log, 'watch', [], { outputMode: 'text-stream', env: { TRV_BUILD: 'debug', TRV_COMPILE_STATUS: '1' } })
      .onExit(() => prom?.reject())
      .onFail(err => vscode.window.showErrorMessage(`Compiler Server: ${err.message}`))
      .onStart(() => {
        this.server.onMessage('start', () => {
          prom.reject();
          vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, cancellable: false, title: 'Compiling' },
            p => {
              prog = p;
              prev = 0;
              return prom = Workspace.manualPromise();
            }
          );
        });
        this.server.onMessage('status', ({ total, idx }) => {
          const value = 100 * (idx / total);
          const delta = (value - prev);
          prev = value;
          prog?.report({ message: `${Math.trunc(value)}% (Files: ${idx + 1}/${total})`, increment: delta });
        });
        this.server.onMessage('complete', () => prom?.resolve());
      });
  }
}