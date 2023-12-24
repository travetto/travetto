import fs from 'node:fs/promises';

import { path, RuntimeIndex } from '@travetto/manifest';
import { AppError, ExecUtil, ExecutionOptions } from '@travetto/base';

import { ActiveShellCommand } from './shell';

export class PackUtil {
  /**
   * Generate .env file
   */
  static buildEnvFile(env: Record<string, string | number | boolean | undefined>): string[] {
    return Object.entries(env)
      .filter(([k, v]) => (v !== undefined))
      .map(([k, v]) => `${k}=${v}`);
  }

  /**
   * Remove directory, determine if errors should be ignored
   * @param src The folder to copy
   * @param dest The folder to copy to
   * @param ignore Should errors be ignored
   */
  static async copyRecursive(src: string, dest: string, ignore = false): Promise<void> {
    const [cmd, ...args] = ActiveShellCommand.copyRecursive(src, dest);
    const res = await ExecUtil.spawn(cmd, args, { catchAsResult: true }).result;
    if (res.code && !ignore) {
      throw new Error(`Failed to copy ${src} to ${dest}`);
    }
  }

  /**
   * Finalize eject output
   */
  static async writeEjectOutput(workspace: string, module: string, output: AsyncIterable<string>, file: string): Promise<void> {
    const vars = { DIST: workspace, TRV_OUT: RuntimeIndex.outputRoot, ROOT: path.cwd(), MOD: module };

    const replaceArgs = (text: string): string => Object.entries(vars)
      .reduce((str, [k, v]) => str.replaceAll(v, ActiveShellCommand.var(k)), text);

    const preamble = [
      ActiveShellCommand.scriptOpen(),
      ...Object.entries(vars).map(([k, v]) => ActiveShellCommand.export(k, v).join(' ')),
    ].join('\n');

    let stream: fs.FileHandle | undefined;

    if (!(file === '-' || file === '/dev/stdout')) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.truncate(file);
      stream = await fs.open(file, 'utf8');
    }

    const write = (text: string): Promise<unknown> | unknown => stream ? stream.write(`${text}\n`) : process.stdout.write(`${text}\n`);

    await write(preamble);
    for await (const line of output) {
      await write(replaceArgs(line));
    }
    await write('\n');

    await stream?.close();
  }

  /**
   * Track result response
   */
  static async runCommand(cmd: string[], opts: ExecutionOptions = {}): Promise<string> {
    const { valid, code, stderr, message, stdout } = await ExecUtil.spawn(cmd[0], cmd.slice(1), {
      stdio: [0, 'pipe', 'pipe', 'ipc'],
      ...opts,
      catchAsResult: true
    }).result;
    if (!valid) {
      process.exitCode = code;
      throw new AppError(stderr || message || 'An unexpected error has occurred');
    }
    return stdout;
  }

  /**
   * Write a file directly
   */
  static async writeRawFile(file: string, contents: string[], mode?: string): Promise<void> {
    await fs.writeFile(file, contents.join('\n'), { encoding: 'utf8', mode });
  }
}