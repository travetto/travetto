import { appendFile, mkdir } from 'fs/promises';

import { path } from '@travetto/manifest';
import { ConsoleManager, defineGlobalEnv, GlobalEnvConfig, ShutdownManager } from '@travetto/base';

import { HelpUtil } from './help';

export class CliHelp extends Error {
  exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

type CommandResponse = void | number | CliHelp;

/**
 * Base command
 */
export interface BaseCliCommand {
  /**
   * Action target of the command
   */
  action(...args: unknown[]): CommandResponse | Promise<CommandResponse>;
  /**
   * Setup environment before command runs
   */
  envInit?(): Promise<GlobalEnvConfig> | GlobalEnvConfig;
  /**
   * Extra help
   */
  help?(): Promise<string> | string;
  /**
   * Supports JSON IPC?
   */
  jsonIpc?(...args: unknown[]): Promise<unknown>;
  /**
   * Is the command active/eligible for usage
   */
  isActive?(): boolean;
}

class CliCommandUtil {
  /**
   * Runs the action at execution time
   */
  static async runAction(cmd: BaseCliCommand, ...args: unknown[]): Promise<void> {
    if (cmd.envInit) {
      defineGlobalEnv(await cmd.envInit());
      ConsoleManager.setDebugFromEnv();
    }

    if (process.env.TRV_CLI_IPC && cmd.jsonIpc) {
      const data = await cmd.jsonIpc(...args);
      if (data !== undefined) {
        const payload = JSON.stringify({ type: cmd.name, data });
        await mkdir(path.dirname(process.env.TRV_CLI_IPC), { recursive: true });
        await appendFile(process.env.TRV_CLI_IPC, `${payload}\n`);
        return;
      }
    }
    return await cmd.action(...args);
  }

  /**
   * Render help with additional message or extra text
   */
  static async showHelp(cmd: BaseCliCommand, err?: string | Error, extra?: string, exitOnError = true): Promise<void> {
    if (err && typeof err !== 'string') {
      err = err.message;
    }
    HelpUtil.showHelp(cmd, err, extra || (await cmd.help?.()) || '');
    if (exitOnError) {
      return ShutdownManager.exit(err ? 1 : 0);
    }
  }

}