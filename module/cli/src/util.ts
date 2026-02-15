import { spawn, type ChildProcess } from 'node:child_process';

import { AppError, JSONUtil, Env, ExecUtil, Runtime, ShutdownManager, Util, WatchUtil } from '@travetto/runtime';

import type { CliCommandShape, CliCommandShapeFields } from './types.ts';

const IPC_ALLOWED_ENV = new Set(['NODE_OPTIONS']);
const IPC_INVALID_ENV = new Set(['PS1', 'INIT_CWD', 'COLOR', 'LANGUAGE', 'PROFILEHOME', '_']);
const validEnv = (key: string): boolean => IPC_ALLOWED_ENV.has(key) || (
  !IPC_INVALID_ENV.has(key) && !/^(npm_|GTK|GDK|TRV|NODE|GIT|TERM_)/.test(key) && !/VSCODE/.test(key)
);

export class CliUtil {
  /**
   * Get a simplified version of a module name
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
  static async runWithRestartOnChange<T extends CliCommandShapeFields>(cmd: T): Promise<void> {
    if (Env.TRV_RESTART_TARGET.isTrue) {
      Env.TRV_RESTART_TARGET.clear();
      ShutdownManager.disableInterrupt();
      return;
    } else if (cmd.restartOnChange !== true) {
      return; // Not restarting, run normal
    }

    ShutdownManager.disableInterrupt();

    let child: ChildProcess | undefined;
    void WatchUtil.watchCompilerEvents('file', () => ShutdownManager.shutdownChild(child!, { reason: 'restart', mode: 'exit' }));
    process
      .on('SIGINT', () => ShutdownManager.shutdownChild(child!, { mode: 'exit' }))
      .on('message', msg => child?.send?.(msg!));

    const env = { ...process.env, ...Env.TRV_RESTART_TARGET.export(true) };

    await WatchUtil.runWithRetry(
      async () => {
        child = spawn(process.argv0, process.argv.slice(1), { env, stdio: ['pipe', 1, 2, 'ipc'] });
        const { code } = await ExecUtil.getResult(child, { catch: true });
        return ShutdownManager.reasonForExitCode(code);
      },
      {
        maxRetries: 5,
        onRetry: async (state, config) => {
          const duration = WatchUtil.computeRestartDelay(state, config);
          console.error(
            '[cli-restart] Restarting subprocess due to change...',
            { waiting: duration, iteration: state.iteration, errorIterations: state.errorIterations || undefined }
          );
          await Util.nonBlockingTimeout(duration);
        },
      }
    );

    await ShutdownManager.shutdown({ mode: 'exit' });
  }

  /**
   * Dispatch IPC payload
   */
  static async runWithDebugIpc<T extends CliCommandShapeFields & CliCommandShape>(cmd: T): Promise<void> {
    if (cmd.debugIpc !== true || !Env.TRV_CLI_IPC.isSet) {
      return; // Not debugging, run normal
    }

    const info = await fetch(Env.TRV_CLI_IPC.value!).catch(() => ({ ok: false }));

    if (!info.ok) {
      return; // Server not running, run normal
    }

    const env: Record<string, string> = {};
    const request = {
      type: '@travetto/cli:run',
      data: {
        name: cmd._cfg!.name,
        env,
        module: cmd.module ?? Runtime.main.name,
        args: process.argv.slice(3),
      }
    };
    console.log('Triggering IPC request', request);

    Object.entries(process.env).forEach(([key, value]) => validEnv(key) && (env[key] = value!));
    const sent = await fetch(Env.TRV_CLI_IPC.value!, { method: 'POST', body: JSONUtil.toUTF8(request) });

    if (!sent.ok) {
      throw new AppError(`IPC Request failed: ${sent.status} ${await sent.text()}`);
    }
  }

  /**
   * Write data to channel and ensure its flushed before continuing
   */
  static async writeAndEnsureComplete(data: unknown, channel: 'stdout' | 'stderr' = 'stdout'): Promise<void> {
    return await new Promise(resolve => process[channel].write(typeof data === 'string' ? data :
      JSONUtil.toUTF8Pretty(data), () => resolve()));
  }

  /**
   * Read extended options from cli inputs, in the form of -o key:value or -o key
   */
  static readExtendedOptions(options?: string[]): Record<string, string | boolean> {
    return Object.fromEntries((options ?? [])?.map(option => [...option.split(':'), true]));
  }
}