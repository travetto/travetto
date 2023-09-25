import vscode from 'vscode';

import { BaseFeature } from '../../base';
import { Activatible } from '../../../core/activation';
import { Workspace } from '../../../core/workspace';

/**
 * Workspace Compilation Support
 */
@Activatible('@travetto/compiler', true)
export class CompilerWatchFeature extends BaseFeature {

  async cleanServer(all?: boolean): Promise<void> {
    await Workspace.spawnCli('clean', all ? ['-a'] : []).result;
  }

  startServer(): void {
    Workspace.spawnCli('watch', []);
  }

  async stopServer(): Promise<void> {
    await Workspace.spawnCli('clean', ['-s']);
  }

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    this.register('start', () => this.startServer());
    this.register('stop', () => this.stopServer());
    this.register('clean', () => this.cleanServer());
    this.register('clean-all', () => this.cleanServer(true));

    this.startServer();
  }
}