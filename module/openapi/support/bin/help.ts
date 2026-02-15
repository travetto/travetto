import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { JSONUtil, ExecUtil, Runtime } from '@travetto/runtime';
import { cliTpl } from '@travetto/cli';

/**
 * Help utility for openapi client command
 */
export class OpenApiClientHelp {

  static async getListOfFormats(dockerImage: string): Promise<string[]> {
    const formatCache = Runtime.toolPath('openapi-formats.json');
    if (!await fs.stat(formatCache).catch(() => false)) {
      const { stdout } = await ExecUtil.getResult(spawn('docker', ['run', '--rm', dockerImage, 'list']));
      const lines = stdout
        .split('DOCUMENTATION')[0]
        .trim()
        .split(/\n/g)
        .filter(line => /^\s+-/.test(line) && !/\((beta|experimental)\)/.test(line))
        .map(line => line.replace(/^\s+-\s+/, '').trim());

      await fs.mkdir(path.dirname(formatCache), { recursive: true });
      await fs.writeFile(formatCache, JSONUtil.toUTF8([...lines.toSorted(),]));
    }
    return await fs.readFile(formatCache).then(JSONUtil.fromBinaryArray<string[]>);
  }

  static async help(dockerImage: string, extendedHelp: boolean): Promise<string[]> {
    const help: string[] = [];
    if (extendedHelp) {
      const formats = await this.getListOfFormats(dockerImage);
      help.push(
        '',
        cliTpl`${{ subtitle: 'Available Formats' }}`,
        '----------------------------------',
        ...formats.map(format => cliTpl`* ${{ input: format }}`)
      );
    }
    return help;
  }
}