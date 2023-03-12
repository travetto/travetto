import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import cp from 'child_process';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil, FileResourceProvider, ShutdownManager } from '@travetto/base';
import { BaseCliCommand, cliTpl, CliCommand } from '@travetto/cli';
import { Alias } from '@travetto/schema';

/**
 * CLI for generating the cli client
 */
@CliCommand()
export class OpenApiClientCommand implements BaseCliCommand {
  #presets: Record<string, [string, object] | [string]>;
  #resources = new FileResourceProvider(['@travetto/openapi#support/resources']);

  /** Show Extended Help */
  @Alias('-x')
  extendedHelp?: boolean;
  /** Additional Properties */
  @Alias('-a', '--additional-properties')
  props: string[] = [];
  /** Input file */
  input = './openapi.yml';
  /** Output folder */
  output = './api-client';
  /** Docker Image to user */
  dockerImage = 'arcsine/openapi-generator:latest';
  /** Watch for file changes */
  watch?: boolean;

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
      const stdout = cp.execSync(`docker run --rm ${this.dockerImage} list`, { stdio: ['pipe', 'pipe'], encoding: 'utf8' }).trim();
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

    return this.extendedHelp ? `${presetText}\n${formatText}` : presetText;
  }

  getArgs(): string {
    return '<format-or-preset>';
  }

  async action(format: string): Promise<void> {
    // Ensure its there
    await fs.mkdir(this.output, { recursive: true });

    let propMap = Object.fromEntries(this.props?.map(p => p.split('=')) ?? []);

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
      '-v', `${this.output}:/workspace`,
      '-v', `${path.dirname(this.input)}:/input`,
      '-it',
      '--rm',
      this.dockerImage,
      'generate',
      '--skip-validate-spec',
      '--remove-operation-id-prefix',
      '-g', format,
      '-o', '/workspace',
      '-i', `/input/${path.basename(this.input)}`,
      ...(this.watch ? ['-w'] : []),
      ...(propList ? ['--additional-properties', propList] : [])
    ];

    const { result } = ExecUtil.spawn('docker', args, { stdio: [0, 1, 2] });
    await result.catch(err => ShutdownManager.exit(1));
  }
}