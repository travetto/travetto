import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as cp from 'child_process';

import { CliCommand, CliUtil, OptionConfig, ListOptionConfig } from '@travetto/cli';
import { ExecUtil } from '@travetto/base';

const presets: Record<string, [string, object] | [string]> =
  JSON.parse(readFileSync(path.resolve(__source.folder, 'resources', 'presets.json'), 'utf8').__posix);

type Options = {
  extendedHelp: OptionConfig<boolean>;
  props: ListOptionConfig<string>;
  input: OptionConfig<string>;
  output: OptionConfig<string>;
  dockerImage: OptionConfig<string>;
  watch: OptionConfig<boolean>;
};
/**
 * CLI for generating the cli client
 */
export class OpenApiClientCommand extends CliCommand<Options> {
  name = 'openapi:client';

  presetMap(prop?: object): string {
    return !prop || Object.keys(prop).length === 0 ? '' : Object.entries(prop).map(([k, v]) => `${k}=${v}`).join(',');
  }

  getListOfFormats(): string[] {
    const formatCache = path.resolve('.trv-openapi-formats.json').__posix;
    if (!existsSync(formatCache)) {
      const stdout = cp.execSync(`docker run --rm ${this.cmd.dockerImage} list`, { stdio: ['pipe', 'pipe'], encoding: 'utf8' }).trim();
      const lines = stdout
        .split('DOCUMENTATION')[0]
        .trim()
        .split(/\n/g)
        .filter(x => /^\s+-/.test(x) && !/\((beta|experimental)\)/.test(x))
        .map(x => x.replace(/^\s+-\s+/, '').trim());

      writeFileSync(formatCache, JSON.stringify([...lines.sort(),]));
    }
    const list: string[] = JSON.parse(readFileSync(formatCache, 'utf8'));
    return list;
  }

  getOptions(): Options {
    return {
      extendedHelp: this.boolOption({ name: 'extended-help', short: 'x', desc: 'Show Extended Help' }),
      props: this.listOption({ name: 'additional-properties', short: 'a', desc: 'Additional Properties' }),
      input: this.option({ desc: 'Input file', def: './openapi.yml', combine: v => path.resolve(v).__posix, completion: true }),
      output: this.option({ desc: 'Output folder', def: './api-client', combine: v => path.resolve(v).__posix, completion: true }),
      dockerImage: this.option({ desc: 'Docker Image to use', def: 'arcsine/openapi-generator:latest' }),
      watch: this.boolOption({ desc: 'Watch for file changes' })
    };
  }

  help(): string {
    const presetLen = Math.max(...Object.keys(presets).map(x => x.length));
    const presetEntries = Object
      .entries(presets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, [cmd, v]]) => [`@trv:${k}`.padEnd(presetLen + 5), [cmd, this.presetMap(v)]] as const);

    const presetText = CliUtil.color`
${{ subtitle: 'Available Presets' }}
----------------------------------
${presetEntries.map(([k, [cmd, param]]) => CliUtil.color`* ${{ input: k }} -- ${{ identifier: cmd }} ${{ param }}`).join('\n')}`;

    const formatText = CliUtil.color`
${{ subtitle: 'Available Formats' }}
----------------------------------
${this.getListOfFormats().map(x => CliUtil.color`* ${{ input: x }}`).join('\n')} `;

    return this.cmd.extendedHelp ? `${presetText}\n${formatText}` : presetText;
  }

  getArgs(): string {
    return '[format-or-preset]';
  }

  async action(format: string): Promise<void> {
    if (!format) {
      this.showHelp(new Error('Format is required'));
    }

    // Ensure its there
    await fs.mkdir(this.cmd.output, { recursive: true });

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
      '--user', `${process.geteuid?.()}:${process.getgid?.()}`,
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