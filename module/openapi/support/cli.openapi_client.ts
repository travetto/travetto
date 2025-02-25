import path from 'node:path';
import cp from 'node:child_process';

import { CliCommandShape, CliCommand, CliFlag } from '@travetto/cli';
import { ExecUtil } from '@travetto/runtime';

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

    const proc = cp.spawn('docker', [
      'run',
      '--rm',
      '-i',
      '-v', `${this.output}:/workspace`,
      '-v', `${path.dirname(this.input)}:/input`,
      '--user', `${process.geteuid?.() ?? 0}:${process.getgid?.() ?? 0}`,
      this.dockerImage,
      // Parameters
      'generate',
      '--skip-validate-spec',
      '--remove-operation-id-prefix',
      '-g', format,
      '-o', '/workspace',
      '-i', `/input/${path.basename(this.input)}`,
      ...(this.props.length ? ['--additional-properties', this.props.join(',')] : [])
    ], {
      stdio: 'inherit'
    });

    const result = await ExecUtil.getResult(proc);

    if (!result.valid) {
      process.exitCode = 1;
    }
  }
}