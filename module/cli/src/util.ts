import fs from 'fs/promises';

import { Env, ExecUtil } from '@travetto/base';
import { path, RootIndex } from '@travetto/manifest';

import { CliCommandShape } from './types';
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
  static runWithRestart<T extends CliCommandShape & { canRestart?: boolean }>(cmd: T): Promise<unknown> | undefined {
    if (cmd.canRestart !== false && Env.isFalse('TRV_CAN_RESTART')) {
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
    const file = process.env.TRV_CLI_IPC;

    if (!file) {
      return false;
    }

    const cfg = CliCommandRegistry.getConfig(cmd);
    const payload = JSON.stringify({
      type: `@travetto/cli:${action}`, data: {
        name: cfg.name,
        commandModule: cfg.module,
        module: RootIndex.manifest.mainModule,
        args: process.argv.slice(3)
      }
    });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `${payload}\n`);
    return true;
  }

  /**
   * Debug if IPC available
   */
  static async debugIfIpc<T extends CliCommandShape & { debugIpc?: boolean }>(cmd: T): Promise<boolean> {
    return cmd.debugIpc !== false && this.triggerIpc('run', cmd);
  }

  /**
   * Write data to channel and ensure its flushed before continuing
   */
  static async writeAndEnsureComplete(data: unknown, channel: 'stdout' | 'stderr' = 'stdout'): Promise<void> {
    return await new Promise(r => process[channel].write(typeof data === 'string' ? data : JSON.stringify(data, null, 2), () => r()));
  }
}