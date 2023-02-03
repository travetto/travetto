import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

import { ActiveShellCommand } from './shell';

export class PackUtil {
  /**
   * Update .env.js with new env data
   */
  static async writeEnvJs(workspace: string, env: Record<string, string | undefined>): Promise<void> {
    const out = path.resolve(workspace, '.env.js');
    let src = '';
    if (!!(await fs.stat(out).catch(() => { }))) {
      src = await fs.readFile(out, 'utf8');
    }
    const lines = Object.entries(env).map(([k, v]) => v ? `process.env['${k}'] = \`${v.replace(/`/g, '\\`')}\`;` : '');
    const content = `${src}\n${lines.join('\n')}`;
    await fs.writeFile(out, content, { encoding: 'utf8' });
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
}