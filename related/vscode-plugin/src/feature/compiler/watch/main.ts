import vscode from 'vscode';

import { Activatible } from '../../../core/activation';
import { ProcessServer } from '../../../core/server';
import { BuildStatus } from '../../../core/build';

import { BaseFeature } from '../../base';

/**
 * Workspace Compilation Support
 */
@Activatible('@travetto/compiler', true)
export class CompilerWatchFeature extends BaseFeature {

  server: ProcessServer<{ type: '' }, { type: '' }>;

  /**
   * On initial activation
   */
  activate(context: vscode.ExtensionContext): void {
    BuildStatus.onBuildWaiting(() => {
      this.server = new ProcessServer(this.log, 'watch', [], { outputMode: 'text-stream', env: { TRV_BUILD: 'debug' } })
      this.server.start();
    });
  }
}