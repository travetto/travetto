import * as vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { Workspace } from '../../../core/workspace';
import { BaseFeature } from '../../base';

/**
 * Clean workspace
 */
@Activatible('base', 'clean')
export class CleanFeature extends BaseFeature {

  async clean(): Promise<void> {
    await Workspace.runMain(Workspace.mainPath(this.module, 'clean'), []).result;
    vscode.window.showInformationMessage('Successfully deleted');
  }

  /**
   * On initial activation
   */
  activate(): void {
    this.register('run', () => this.clean());
  }
}