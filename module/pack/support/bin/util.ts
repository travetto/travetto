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
  static async writeEjectOutput(
    workspace: string,
    module: string,
    output: string[],
    file: string
  ): Promise<void> {
    const vars = {
      DIST: workspace,
      TRV_OUT: path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.outputFolder),
      ROOT: path.cwd(),
      MOD: module
    };

    const content = [
      ActiveShellCommand.scriptOpen(),
      ...Object.entries(vars).map(([k, v]) => ActiveShellCommand.export(k, v).join(' ')),
      Object.entries(vars).reduce((text, [k, v]) => text.replaceAll(v, ActiveShellCommand.var(k)), output.join('\n')),
      '', ''
    ].join('\n');

    if (file === '-' || file === '/dev/stdout') {
      console.log!(content);
    } else {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content, 'utf8');
    }
  }
}