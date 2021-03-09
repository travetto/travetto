import * as vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { BaseFeature } from '../../base';

/**
 * Clean workspace
 */
@Activatible('@travetto/boot', 'clean')
export class CleanFeature extends BaseFeature {

  async clean() {
    await this.runBin('clean');
    vscode.window.showInformationMessage('Successfully deleted');
  }

  /**
   * On initial activation
   */
  activate() {
    this.register('run', () => this.clean());
  }
}