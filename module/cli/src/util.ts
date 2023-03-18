import { ConsoleManager, defineGlobalEnv } from '@travetto/base';
import { path, RootIndex } from '@travetto/manifest';

import { CliCommandShape } from './types';

export class CliUtil {
  /**
   * Are we running from a mono-root?
   */
  static get monoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo && path.cwd() === RootIndex.manifest.workspacePath;
  }

  /**
   * Get a simplified version of a module name
   * @returns
   */
  static getSimpleModuleName(name = RootIndex.mainPackage.name): string {
    return name.replace(/[\/]/, '_').replace(/@/, '');
  }

  /**
   * Prepare environment/rootindex before run
   * @param cmd
   */
  static async prepareRun(cmd: CliCommandShape & { module?: string, env?: string, profile?: string[] }): Promise<void> {
    defineGlobalEnv({ envName: cmd.env, profiles: cmd.profile });
    ConsoleManager.setDebugFromEnv();

    if (cmd.module && cmd.module !== RootIndex.mainModule.name) { // Mono-repo support
      RootIndex.reinitForModule(cmd.module); // Reinit with specified module
    }
  }
}