import vscode from 'vscode';

import { BaseFeature } from '../../base';
import { Activatible } from '../../../core/activation';
import { Workspace } from '../../../core/workspace';

/**
 * Workspace Compilation Support
 */
@Activatible('@travetto/compiler', true)
export class CompilerWatchFeature extends BaseFeature {

  async cleanServer(): Promise<void> {
    await Workspace.spawnCli('clean', []).result;
  }

  startServer(): void {
    Workspace.spawnCli('watch', []);
  }

  async stopServer(): Promise<void> {
    await Workspace.spawnCli('manifest', ['--stop-server']);
  }

  async restartServer(): Promise<void> {
    await this.cleanServer();
    this.startServer();
  }

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    this.register('start', () => this.startServer());
    this.register('stop', () => this.stopServer());
    this.register('restart', () => this.restartServer());
    this.register('clean', () => this.cleanServer());

    this.startServer();
  }
}