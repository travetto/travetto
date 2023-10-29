import vscode from 'vscode';

import { BaseFeature } from '../../base';
import { Activatible } from '../../../core/activation';
import { Workspace } from '../../../core/workspace';

/**
 * Workspace Compilation Support
 */
@Activatible('@travetto/compiler', true)
export class CompilerWatchFeature extends BaseFeature {

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    for (const op of ['start', 'stop', 'restart', 'clean']) {
      this.register(op, () => Workspace.spawnCompiler(op));
    }

    Workspace.spawnCompiler('start');
  }
}