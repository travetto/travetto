import fs from 'fs/promises';
import cp from 'child_process';

import { path, RootIndex } from '@travetto/manifest';
import { cliTpl } from '@travetto/cli';
import { OpenApiClientPresets } from './presets';

/**
 * Help utility for openapi client command
 */
export class OpenApiClientHelp {

  static async getListOfFormats(dockerImage: string): Promise<string[]> {
    const formatCache = path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.outputFolder, 'trv-openapi-formats.json');
    if (!fs.stat(formatCache).catch(() => false)) {
      const stdout = cp.execSync(`docker run --rm ${dockerImage} list`, { stdio: ['pipe', 'pipe'], encoding: 'utf8' }).trim();
      const lines = stdout
        .split('DOCUMENTATION')[0]
        .trim()
        .split(/\n/g)
        .filter(x => /^\s+-/.test(x) && !/\((beta|experimental)\)/.test(x))
        .map(x => x.replace(/^\s+-\s+/, '').trim());

      await fs.writeFile(formatCache, JSON.stringify([...lines.sort(),]));
    }
    const list: string[] = JSON.parse(await fs.readFile(formatCache, 'utf8'));
    return list;
  }

  static async help(dockerImage: string, extendedHelp: boolean): Promise<string> {
    const presets = await OpenApiClientPresets.getPresets();
    const presetLen = Math.max(...Object.keys(presets).map(x => x.length));
    const presetEntries = Object
      .entries(presets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, [cmd, v]]) => [`@travetto/${k}`.padEnd(presetLen + 5), [cmd, OpenApiClientPresets.presetMap(v)]] as const);

    const presetText = cliTpl`
${{ subtitle: 'Available Presets' }}
----------------------------------
${presetEntries.map(([k, [cmd, param]]) => cliTpl`* ${{ input: k }} -- ${{ identifier: cmd }} ${{ param }}`).join('\n')}`;

    const formatText = cliTpl`
${{ subtitle: 'Available Formats' }}
----------------------------------
${(await this.getListOfFormats(dockerImage)).map(x => cliTpl`* ${{ input: x }}`).join('\n')} `;

    return extendedHelp ? `${presetText}\n${formatText}` : presetText;
  }
}