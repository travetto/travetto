import { Env, ExecUtil, GlobalEnv } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

export class CliUtil {
  /**
   * Are we running from a mono-root?
   */
  static get monoRoot(): boolean {
    return !!RootIndex.manifest.monoRepo && RootIndex.mainModule.sourcePath === RootIndex.manifest.workspacePath;
  }

  /**
   * Get a simplified version of a module name
   * @returns
   */
  static getSimpleModuleName(name = RootIndex.mainModuleName): string {
    return name.replace(/[\/]/, '_').replace(/@/, '');
  }

  /**
   * Run a command as restartable, linking into self
   */
  static runAsRestartable(): Promise<unknown> | undefined {
    if (!GlobalEnv.devMode || Env.isFalse('TRV_IS_RESTARTABLE')) {
      delete process.env.TRV_IS_RESTARTABLE;
      return;
    }
    return ExecUtil.spawnWithRestart(process.argv0, process.argv.slice(1), {
      env: { TRV_DYNAMIC: '1', TRV_IS_RESTARTABLE: '0' },
      stdio: [0, 1, 2, 'ipc']
    });
  }
}