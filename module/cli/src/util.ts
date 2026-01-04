import { spawn, type ChildProcess } from 'node:child_process';

import { describeFunction, Env, ExecUtil, Util, Runtime, ShutdownManager, watchFiles } from '@travetto/runtime';

import { CliCommandShape, CliCommandShapeFields } from './types.ts';

const IPC_ALLOWED_ENV = new Set(['NODE_OPTIONS']);
const IPC_INVALID_ENV = new Set(['PS1', 'INIT_CWD', 'COLOR', 'LANGUAGE', 'PROFILEHOME', '_']);
const validEnv = (key: string): boolean => IPC_ALLOWED_ENV.has(key) || (
  !IPC_INVALID_ENV.has(key) && !/^(npm_|GTK|GDK|TRV|NODE|GIT|TERM_)/.test(key) && !/VSCODE/.test(key)
);

type RunWithRestartOptions = {
  maxRetriesPerMinute?: number;
  relayInterrupt?: boolean;
};

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
  static async runWithRestartOnChange<T extends CliCommandShapeFields & CliCommandShape>(cmd: T, config?: RunWithRestartOptions): Promise<boolean> {
    if (cmd.restartOnChange !== true) {
      ExecUtil.listenForRestartSignal();
      return false;
    }

    let subProcess: ChildProcess | undefined;
    void watchFiles(() => ExecUtil.sendRestartSignal(subProcess));

    const env = { ...process.env, ...Env.TRV_RESTART_ON_CHANGE.export(false) };

    await Util.runWithRestart({
      onInit: stop => ShutdownManager.onGracefulShutdown(stop),
      onRestart: ({ iteration }) => console.error('Restarting...', { pid: process.pid, iteration }),
      onFailure: ({ iteration }) => console.error('Max restarts exceeded, exiting...', { pid: process.pid, iteration }),
      run: async () => {
        const result = await ExecUtil.deferToSubprocess(
          subProcess = spawn(process.argv0, process.argv.slice(1), { env, stdio: [0, 1, 2, 'ipc'] }),
          config?.relayInterrupt ?? true
        );
        // Did we exit due to restart request?
        return result.code === ExecUtil.RESTART_CODE;
      }
    });

    await ShutdownManager.gracefulShutdown('cli-restart');
    process.exit();
  }

  /**
   * Dispatch IPC payload
   */
  static async runWithDebugIpc<T extends CliCommandShapeFields & CliCommandShape>(cmd: T): Promise<boolean> {
    if (cmd.debugIpc !== true || !Env.TRV_CLI_IPC.isSet) {
      return false;
    }

    const info = await fetch(Env.TRV_CLI_IPC.value!).catch(() => ({ ok: false }));

    if (!info.ok) { // Server not running
      return false;
    }

    const env: Record<string, string> = {};
    const request = {
      type: `@travetto/cli:run`,
      data: {
        name: cmd._cfg!.name,
        env,
        // TODO: Is this needed?
        commandModule: describeFunction(cmd.constructor).module,
        module: Runtime.main.name,
        args: process.argv.slice(3),
      }
    };
    console.log('Triggering IPC request', request);

    Object.entries(process.env).forEach(([key, value]) => validEnv(key) && (env[key] = value!));
    const sent = await fetch(Env.TRV_CLI_IPC.value!, { method: 'POST', body: JSON.stringify(request) });
    return sent.ok;
  }

  /**
   * Write data to channel and ensure its flushed before continuing
   */
  static async writeAndEnsureComplete(data: unknown, channel: 'stdout' | 'stderr' = 'stdout'): Promise<void> {
    return await new Promise(resolve => process[channel].write(typeof data === 'string' ? data : JSON.stringify(data, null, 2), () => resolve()));
  }

  /**
   * Read extended options from cli inputs, in the form of -o key:value or -o key
   */
  static readExtendedOptions(options?: string[]): Record<string, string | boolean> {
    return Object.fromEntries((options ?? [])?.map(option => [...option.split(':'), true]));
  }
}