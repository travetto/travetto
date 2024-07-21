import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { ExecUtil, Runtime } from '@travetto/base';
import { cliTpl } from '@travetto/cli';

/**
 * Help utility for openapi client command
 */
export class OpenApiClientHelp {

  static async getListOfFormats(dockerImage: string): Promise<string[]> {
    const formatCache = Runtime.context.toolPath('openapi-formats.json');
    if (!await fs.stat(formatCache).catch(() => false)) {
      const { stdout } = await ExecUtil.getResult(spawn('docker', ['run', '--rm', dockerImage, 'list'], { shell: false }));
      const lines = stdout
        .split('DOCUMENTATION')[0]
        .trim()
        .split(/\n/g)
        .filter(x => /^\s+-/.test(x) && !/\((beta|experimental)\)/.test(x))
        .map(x => x.replace(/^\s+-\s+/, '').trim());

      await fs.mkdir(path.dirname(formatCache), { recursive: true });
      await fs.writeFile(formatCache, JSON.stringify([...lines.sort(),]));
    }
    const list: string[] = JSON.parse(await fs.readFile(formatCache, 'utf8'));
    return list;
  }

  static async help(dockerImage: string, extendedHelp: boolean): Promise<string[]> {
    const help: string[] = [];
    if (extendedHelp) {
      const formats = await this.getListOfFormats(dockerImage);
      help.push(
        '',
        cliTpl`${{ subtitle: 'Available Formats' }}`,
        '----------------------------------',
        ...formats.map(x => cliTpl`* ${{ input: x }}`)
      );
    }
    return help;
  }
}