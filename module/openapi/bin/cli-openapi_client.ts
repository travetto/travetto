import * as path from 'path';
import * as fs from 'fs';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { AppCache, ExecUtil, PathUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

const presets = JSON.parse(fs.readFileSync(PathUtil.resolveUnix(__dirname, '..', 'resources', 'presets.json'), 'utf8')) as Record<string, [string, object] | [string]>;

/**
 * CLI for generating the cli client
 */
export class OpenApiClientPlugin extends BasePlugin {
  name = 'openapi:client';

  presetMap(prop?: object) {
    return !prop || Object.keys(prop).length === 0 ? '' : Object.entries(prop).map(([k, v]) => `${k}=${v}`).join(',');
  }

  getListOfFormats() {
    const json = AppCache.getOrSet('openapi-formats.json', () => {
      const stdout = ExecUtil.execSync('docker', ['run', '--rm', this.cmd.dockerImage, 'list']);
      const lines = stdout
        .split('DOCUMENTATION')[0]
        .trim()
        .split(/\n/g)
        .filter(x => /^\s+-/.test(x) && !/\((beta|experimental)\)/.test(x))
        .map(x => x.replace(/^\s+-\s+/, '').trim());
      return JSON.stringify([
        ...lines.sort(),
      ]);
    });
    return JSON.parse(json) as string[];
  }

  getOptions() {
    return {
      extendedHelp: this.boolOption({ name: 'extended-help', short: 'x', desc: 'Show Extended Help' }),
      props: this.listOption({ name: 'additional-properties', short: 'a', desc: 'Additional Properties' }),
      input: this.option({ desc: 'Input file', def: './openapi.yml', combine: v => PathUtil.resolveUnix(v), completion: true }),
      output: this.option({ desc: 'Output folder', def: './api-client', combine: v => PathUtil.resolveUnix(v), completion: true }),
      dockerImage: this.option({ desc: 'Docker Image to use', def: 'arcsine/openapi-generator:latest' }),
      watch: this.boolOption({ desc: 'Watch for file changes' })
    };
  }

  help() {
    const presetLen = Math.max(...Object.keys(presets).map(x => x.length));
    const presetEntries = Object
      .entries(presets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, [cmd, v]]) => [`@trv:${k}`.padEnd(presetLen + 5), [cmd, this.presetMap(v)]] as const);

    const presetText = color`
${{ subtitle: 'Available Presets' }}
----------------------------------
${presetEntries.map(([k, [cmd, param]]) => color`* ${{ input: k }} -- ${{ identifier: cmd }} ${{ param }}`).join('\n')}`;

    const formatText = color`
${{ subtitle: 'Available Formats' }}
----------------------------------
${this.getListOfFormats().map(x => color`* ${{ input: x }}`).join('\n')} `;

    return this.cmd.extendedHelp ? `${presetText}\n${formatText}` : presetText;
  }

  getArgs() {
    return '[format-or-preset]';
  }

  async action(format: string) {
    if (!format) {
      this.showHelp(new Error('Format is required'));
    }

    // Ensure its there
    await fs.promises.mkdir(this.cmd.output, { recursive: true });

    let propMap = Object.fromEntries(this.cmd.props?.map(p => p.split('=')) ?? []);

    if (format.startsWith('@trv:')) {
      const key = format.split('@trv:')[1];
      const [fmt, props] = presets[key];
      format = fmt;
      propMap = { ...props, ...propMap };
    }

    const propList = this.presetMap(propMap);

    const args = [
      'run',
      '--user', `${process.geteuid()}:${process.getgid()}`,
      '-v', `${this.cmd.output}:/workspace`,
      '-v', `${path.dirname(this.cmd.input)}:/input`,
      '-it',
      '--rm',
      this.cmd.dockerImage,
      'generate',
      '--skip-validate-spec',
      '--remove-operation-id-prefix',
      '-g', format,
      '-o', '/workspace',
      '-i', `/input/${path.basename(this.cmd.input)}`,
      ...(this.cmd.watch ? ['-w'] : []),
      ...(propList ? ['--additional-properties', propList] : [])
    ];

    const { result } = ExecUtil.spawn('docker', args, { stdio: [0, 1, 2] });
    await result.catch(err => process.exit(1));
  }
}