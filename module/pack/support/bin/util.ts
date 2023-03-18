import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

import { ActiveShellCommand } from './shell';

export class PackUtil {
  /**
   * Generate env.js
   */
  static buildEnvJS(env: Record<string, string | number | boolean | undefined>): string[] {
    const entries = Object.entries(env)
      .filter(([k, v]) => (v !== undefined))
      .map(([k, v]) => [k, `${v}`]);
    return entries.map(([k, v]) => `process.env.${k} = '${v}';`);
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
    const vars = { DIST: workspace, TRV_OUT: RootIndex.outputRoot, ROOT: path.cwd(), MOD: module };

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
}