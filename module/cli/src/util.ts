import { spawn } from 'node:child_process';

import { Runtime, Env, ExecUtil, ShutdownManager } from '@travetto/base';

import { CliCommandShape, CliCommandShapeFields, RunResponse } from './types';

const IPC_ALLOWED_ENV = new Set(['NODE_OPTIONS']);
const IPC_INVALID_ENV = new Set(['PS1', 'INIT_CWD', 'COLOR', 'LANGUAGE', 'PROFILEHOME', '_']);
const validEnv = (k: string): boolean => IPC_ALLOWED_ENV.has(k) || (!IPC_INVALID_ENV.has(k) && !/^(npm_|GTK|GDK|TRV|NODE|GIT|TERM_)/.test(k) && !/VSCODE/.test(k));

export class CliUtil {
  /**
   * Get a simplified version of a module name
   * @returns
   */
  static getSimpleModuleName(placeholder: string, module?: string): string {
    const simple = (module ?? Runtime.main.name).replace(/[\/]/, '_').replace(/@/, '');
    if (!simple) {
      return placeholder;
    } else if (!module && Runtime.monoRoot) {
      return placeholder;
    } else {
      return placeholder.replace('<module>', simple);
    }
  }

  /**
   * Run a command as restartable, linking into self
   */
  static runWithRestart<T extends CliCommandShapeFields & CliCommandShape>(cmd: T, ipc?: boolean): Promise<unknown> | undefined {
    if (ipc && process.connected) {
      process.once('disconnect', () => process.exit());
    }
    if (Env.TRV_CAN_RESTART.isFalse || !(cmd.canRestart ?? !Env.production)) {
      Env.TRV_CAN_RESTART.clear();
      return;
    }
    return ExecUtil.withRestart(() => spawn(process.argv0, process.argv.slice(1), {
      env: {
        ...process.env,
        ...Env.TRV_CAN_RESTART.export(false)
      },
      stdio: [0, 1, 2, ipc ? 'ipc' : undefined]
    }));
  }

  /**
   * Dispatch IPC payload
   */
  static async triggerIpc<T extends CliCommandShape>(action: 'run', cmd: T): Promise<boolean> {
    if (!Env.TRV_CLI_IPC.isSet) {
      return false;
    }

    const info = await fetch(Env.TRV_CLI_IPC.val!).catch(() => ({ ok: false }));

    if (!info.ok) { // Server not running
      return false;
    }

    const env: Record<string, string> = {};
    const req = {
      type: `@travetto/cli:${action}`,
      data: {
        name: cmd._cfg!.name, env,
        commandModule: cmd._cfg!.commandModule,
        module: Runtime.main.name,
        args: process.argv.slice(3),
      }
    };
    console.log('Triggering IPC request', req);

    Object.entries(process.env).forEach(([k, v]) => validEnv(k) && (env[k] = v!));
    const sent = await fetch(Env.TRV_CLI_IPC.val!, { method: 'POST', body: JSON.stringify(req) });
    return sent.ok;
  }

  /**
   * Debug if IPC available
   */
  static async debugIfIpc<T extends CliCommandShapeFields & CliCommandShape>(cmd: T): Promise<boolean> {
    return (cmd.debugIpc ?? !Env.production) && this.triggerIpc('run', cmd);
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
        ShutdownManager.onGracefulShutdown(async () => result.close()); // Tie shutdown into app close
      }
      if ('wait' in result) {
        await result.wait(); // Wait for close signal
      } else if ('on' in result) {
        await new Promise<void>(res => result.on('close', res)); // Wait for callback
      }
    }
  }
}