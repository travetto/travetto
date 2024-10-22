import { spawn } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';

import { Env, ExecUtil, ShutdownManager, Runtime, AppError, TimeSpan, TimeUtil, Util } from '@travetto/runtime';

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
    if (Env.TRV_CAN_RESTART.isFalse || !(cmd.canRestart ?? !Runtime.production)) {
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
    return (cmd.debugIpc ?? !Runtime.production) && this.triggerIpc('run', cmd);
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

  /**
   * Wait for the url to return a valid response
   */
  static async waitForHttp(url: URL | string, timeout: TimeSpan | number = '5s'): Promise<string> {
    const parsed = typeof url === 'string' ? new URL(url) : url;
    const ssl = parsed.protocol === 'https:';

    const timeoutMs = TimeUtil.asMillis(timeout);
    const port = parseInt(parsed.port || (ssl ? '443' : '80'), 10);
    await this.waitForPort(port, timeoutMs);

    const start = Date.now();
    while ((Date.now() - start) < timeoutMs) {
      const [status, body] = await new Promise<[number, string]>((resolve) => {
        const data: Buffer[] = [];
        const res = (s: number): void => resolve([s, Buffer.concat(data).toString('utf8')]);
        try {
          const client = ssl ? https : http;
          const req = client.get(url, (msg) =>
            msg
              .on('data', (d) => { data.push(Buffer.from(d)); }) // Consume data
              .on('error', (err) => res(500))
              .on('end', () => res((msg.statusCode || 200)))
              .on('close', () => res((msg.statusCode || 200))));
          req.on('error', (err) => res(500));
        } catch {
          res(400);
        }
      });
      if (status >= 200 && status <= 299) {
        return body; // We good
      }
      await Util.blockingTimeout(100);
    }
    throw new AppError('Could not make http connection to url');
  }

  /**
   * Wait for a TCP port to become available
   */
  static async waitForPort(port: number, timeout: TimeSpan | number = '5s'): Promise<void> {
    const start = Date.now();
    const timeoutMs = TimeUtil.asMillis(timeout);
    while ((Date.now() - start) < timeoutMs) {
      try {
        await new Promise((res, rej) => {
          try {
            const sock: net.Socket = net.createConnection(port, 'localhost')
              .on('connect', res)
              .on('connect', () => sock.destroy())
              .on('timeout', rej)
              .on('error', rej);
          } catch (err) {
            rej(err);
          }
        });
        return;
      } catch {
        await Util.blockingTimeout(50);
      }
    }
    throw new AppError('Could not acquire port');
  }
}