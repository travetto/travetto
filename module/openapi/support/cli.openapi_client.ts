import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { ExecUtil, ShutdownManager } from '@travetto/base';
import { CliCommandShape, CliCommand, CliFlag } from '@travetto/cli';

import { OpenApiClientHelp } from './bin/help';
import { OpenApiClientPresets } from './bin/presets';

/**
 * CLI for generating the cli client
 */
@CliCommand()
export class OpenApiClientCommand implements CliCommandShape {
  @CliFlag({ desc: 'Show Extended Help', short: '-x' })
  extendedHelp?: boolean;
  @CliFlag({ desc: 'Additional Properties', short: '-a', name: '--additional-properties' })
  props: string[] = [];
  @CliFlag({ desc: 'Input file' })
  input = './openapi.yml';
  @CliFlag({ desc: 'Output folder' })
  output = './api-client';
  @CliFlag({ desc: 'Docker Image to user' })
  dockerImage = 'arcsine/openapi-generator:latest';
  @CliFlag({ desc: 'Watch for file changes' })
  watch?: boolean;

  async help(): Promise<string[]> {
    return OpenApiClientHelp.help(this.dockerImage, this.extendedHelp ?? false);
  }

  async main(format: string): Promise<void> {
    // Ensure its there
    await fs.mkdir(this.output, { recursive: true });

    let propMap = Object.fromEntries(this.props?.map(p => p.split('=')) ?? []);

    if (format.startsWith('@travetto/')) {
      const key = format.split('@travetto/')[1];
      const [fmt, props] = (await OpenApiClientPresets.getPresets())[key];
      format = fmt;
      propMap = { ...props, ...propMap };
    }

    const propList = OpenApiClientPresets.presetMap(propMap);

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