import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import cp from 'child_process';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil, FileResourceProvider } from '@travetto/base';
import { BaseCliCommand, cliTpl, OptionConfig, ListOptionConfig } from '@travetto/cli';

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
export class OpenApiClientCommand extends BaseCliCommand<Options> {
  #presets: Record<string, [string, object] | [string]>;
  name = 'openapi:client';
  #resources = new FileResourceProvider(['@travetto/openapi#support/resources']);

  async getPresets(): Promise<Record<string, [string, object] | [string]>> {
    if (!this.#presets) {
      const text = await this.#resources.read('presets.json');
      this.#presets = JSON.parse(text);
    }
    return this.#presets;
  }

  presetMap(prop?: object): string {
    return !prop || Object.keys(prop).length === 0 ? '' : Object.entries(prop).map(([k, v]) => `${k}=${v}`).join(',');
  }

  getListOfFormats(): string[] {
    const formatCache = path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.outputFolder, 'trv-openapi-formats.json');
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
      input: this.option({ desc: 'Input file', def: './openapi.yml', combine: v => path.resolve(v), completion: true }),
      output: this.option({ desc: 'Output folder', def: './api-client', combine: v => path.resolve(v), completion: true }),
      dockerImage: this.option({ desc: 'Docker Image to use', def: 'arcsine/openapi-generator:latest' }),
      watch: this.boolOption({ desc: 'Watch for file changes' })
    };
  }

  async help(): Promise<string> {
    const presets = await this.getPresets();
    const presetLen = Math.max(...Object.keys(presets).map(x => x.length));
    const presetEntries = Object
      .entries(presets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, [cmd, v]]) => [`@travetto/${k}`.padEnd(presetLen + 5), [cmd, this.presetMap(v)]] as const);

    const presetText = cliTpl`
${{ subtitle: 'Available Presets' }}
----------------------------------
${presetEntries.map(([k, [cmd, param]]) => cliTpl`* ${{ input: k }} -- ${{ identifier: cmd }} ${{ param }}`).join('\n')}`;

    const formatText = cliTpl`
${{ subtitle: 'Available Formats' }}
----------------------------------
${this.getListOfFormats().map(x => cliTpl`* ${{ input: x }}`).join('\n')} `;

    return this.cmd.extendedHelp ? `${presetText}\n${formatText}` : presetText;
  }

  getArgs(): string {
    return '<format-or-preset>';
  }

  async action(format: string): Promise<void> {
    if (!format) {
      return this.showHelp('Format is required');
    }

    // Ensure its there
    await fs.mkdir(this.cmd.output, { recursive: true });

    let propMap = Object.fromEntries(this.cmd.props?.map(p => p.split('=')) ?? []);

    if (format.startsWith('@travetto/')) {
      const key = format.split('@travetto/')[1];
      const [fmt, props] = (await this.getPresets())[key];
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
    await result.catch(err => this.exit(1));
  }
}