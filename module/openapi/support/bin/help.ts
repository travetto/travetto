import fs from 'node:fs/promises';

import { ManifestFileUtil, path, RuntimeIndex } from '@travetto/manifest';
import { cliTpl } from '@travetto/cli';
import { OpenApiClientPresets } from './presets';
import { ExecUtil } from '@travetto/base';

/**
 * Help utility for openapi client command
 */
export class OpenApiClientHelp {

  static async getListOfFormats(dockerImage: string): Promise<string[]> {
    const formatCache = ManifestFileUtil.toolPath(RuntimeIndex, 'openapi-formats.json');
    if (!await fs.stat(formatCache).catch(() => false)) {
      const stdout = ExecUtil.spawn('docker', ['run', '--rm', dockerImage, 'list']);
      const res = await stdout.result;
      const lines = res.stdout
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
    const presets = await OpenApiClientPresets.getPresets();
    const presetLen = Math.max(...Object.keys(presets).map(x => x.length));
    const presetEntries = Object
      .entries(presets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, [cmd, v]]) => [`@travetto/${k}`.padEnd(presetLen + 5), [cmd, OpenApiClientPresets.presetMap(v)]] as const);

    const presetText = [
      cliTpl`${{ subtitle: 'Available Presets' }}`,
      '----------------------------------',
      ...presetEntries.map(([k, [cmd, param]]) => cliTpl`* ${{ input: k }} -- ${{ identifier: cmd }} ${{ param }}`),
    ];

    if (extendedHelp) {
      const formats = await this.getListOfFormats(dockerImage);
      presetText.push(
        '',
        cliTpl`${{ subtitle: 'Available Formats' }}`,
        '----------------------------------',
        ...formats.map(x => cliTpl`* ${{ input: x }}`)
      );
    }
    return presetText;
  }
}