import { CompilerClient, Env, ExecUtil, GlobalEnv } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

import { CliCommandShape, CliCommandShapeFields } from './types';
import { CliCommandRegistry } from './registry';

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
  static runWithRestart<T extends CliCommandShapeFields>(cmd: T): Promise<unknown> | undefined {
    const canRestart = cmd.canRestart ??= GlobalEnv.devMode;

    if (canRestart === false || Env.isFalse('TRV_CAN_RESTART')) {
      delete process.env.TRV_CAN_RESTART;
      return;
    }
    return ExecUtil.spawnWithRestart(process.argv0, process.argv.slice(1), {
      env: { TRV_DYNAMIC: '1', TRV_CAN_RESTART: '0' },
      stdio: [0, 1, 2, 'ipc']
    });
  }

  /**
   * Dispatch IPC payload
   */
  static async triggerIpc<T extends CliCommandShape>(action: 'run', cmd: T): Promise<boolean> {
    if (!process.env.TRV_CLI_IPC) {
      return false;
    }

    const client = new CompilerClient({});

    const info = await client.getInfo(true);

    if (!info) { // Server not running
      return false;
    }

    const defaultEnvKeys = new Set(Object.keys(info.env ?? {}));
    defaultEnvKeys.add('PS1').add('INIT_CWD').add('COLOR').add('LANGUAGE').add('PROFILEHOME').add('_');

    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        !defaultEnvKeys.has(k) && !/^(npm_|GTK|GDK|TRV|NODE|GIT|TERM_)/.test(k) && !/VSCODE/.test(k)
      )
    );

    const cfg = CliCommandRegistry.getConfig(cmd);
    const req = {
      type: `@travetto/cli:${action}`,
      ipc: process.env.TRV_CLI_IPC,
      data: {
        name: cfg.name,
        commandModule: cfg.commandModule,
        module: RootIndex.manifest.mainModule,
        args: process.argv.slice(3),
        env
      }
    };

    console.log('Triggering IPC request', req);

    await client.sendEvent('custom', req);
    return true;
  }

  /**
   * Debug if IPC available
   */
  static async debugIfIpc<T extends CliCommandShapeFields & CliCommandShape>(cmd: T): Promise<boolean> {
    const canDebug = cmd.debugIpc ??= GlobalEnv.devMode;
    return canDebug !== false && this.triggerIpc('run', cmd);
  }

  /**
   * Write data to channel and ensure its flushed before continuing
   */
  static async writeAndEnsureComplete(data: unknown, channel: 'stdout' | 'stderr' = 'stdout'): Promise<void> {
    return await new Promise(r => process[channel].write(typeof data === 'string' ? data : JSON.stringify(data, null, 2), () => r()));
  }
}