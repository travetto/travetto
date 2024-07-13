import path from 'node:path';

import { CliCommandShape, CliCommand, CliFlag } from '@travetto/cli';
import { DockerContainer } from '@travetto/command';
import { ExecUtil } from '@travetto/base';

import { OpenApiClientHelp } from './bin/help';

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
  dockerImage = 'openapitools/openapi-generator-cli:latest';

  async help(): Promise<string[]> {
    return OpenApiClientHelp.help(this.dockerImage, this.extendedHelp ?? false);
  }

  async main(format: string): Promise<void> {
    this.output = path.resolve(this.output);
    this.input = path.resolve(this.input);

    const cmd = new DockerContainer(this.dockerImage)
      .setUser(process.geteuid?.() ?? 0, process.getgid?.() ?? 0)
      .addVolume(this.output, '/workspace')
      .addVolume(path.dirname(this.input), '/input')
      .setInteractive(true)
      .setTTY(false)
      .setDeleteOnFinish(true);

    const proc = await cmd.run([
      'generate',
      '--skip-validate-spec',
      '--remove-operation-id-prefix',
      '-g', format,
      '-o', '/workspace',
      '-i', `/input/${path.basename(this.input)}`,
      ...(this.props.length ? ['--additional-properties', this.props.join(',')] : [])
    ]);

    const result = await ExecUtil.getResult(proc);
    if (!result.valid) {
      process.exitCode = 1;
    }
  }
}