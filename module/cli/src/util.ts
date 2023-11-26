import { Env, ExecUtil, GlobalEnv, ShutdownManager } from '@travetto/base';
import { RootIndex, path } from '@travetto/manifest';

import { CliCommandShape, CliCommandShapeFields, RunResponse } from './types';
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
  static getSimpleModuleName(placeholder: string, module?: string): string {
    const simple = (module ?? RootIndex.mainModuleName).replace(/[\/]/, '_').replace(/@/, '');
    if (!simple) {
      return placeholder;
    } else if (!module && this.monoRoot) {
      return placeholder;
    } else {
      return placeholder.replace('<module>', simple);
    }
  }

  /**
   * Run a command as restartable, linking into self
   */
  static runWithRestart<T extends CliCommandShapeFields & CliCommandShape>(cmd: T): Promise<unknown> | undefined {
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
    const ipcUrl = process.env.TRV_CLI_IPC;

    if (!ipcUrl) {
      return false;
    }

    const info = await fetch(ipcUrl).catch(() => ({ ok: false }));

    if (!info.ok) { // Server not running
      return false;
    }

    const cfg = CliCommandRegistry.getConfig(cmd);
    const req = {
      type: `@travetto/cli:${action}`,
      data: {
        name: cfg.name,
        commandModule: cfg.commandModule,
        module: RootIndex.manifest.mainModule,
        args: process.argv.slice(3),
      }
    };

    console.log('Triggering IPC request', req);

    const defaultEnvKeys = new Set(['PS1', 'INIT_CWD', 'COLOR', 'LANGUAGE', 'PROFILEHOME', '_']);
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        !defaultEnvKeys.has(k) && !/^(npm_|GTK|GDK|TRV|NODE|GIT|TERM_)/.test(k) && !/VSCODE/.test(k)
      )
    );

    Object.assign(req.data, { env });

    const sent = await fetch(ipcUrl, { method: 'POST', body: JSON.stringify(req) });
    return sent.ok;
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

  /**
   * Listen for a run response to finish
   */
  static async listenForResponse(result: RunResponse): Promise<void> {
    // Listen to result if non-empty
    if (result !== undefined && result !== null) {
      if ('close' in result) {
        ShutdownManager.onShutdown(result, result); // Tie shutdown into app close
      }
      if ('wait' in result) {
        await result.wait(); // Wait for close signal
      } else if ('on' in result) {
        await new Promise<void>(res => result.on('close', res)); // Wait for callback
      }
    }
  }
}