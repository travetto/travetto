import path from 'node:path';
import cp from 'node:child_process';

import { CliCommandShape, CliCommand, CliFlag } from '@travetto/cli';
import { ExecUtil } from '@travetto/runtime';

import { OpenApiClientHelp } from './bin/help.ts';

/**
 * CLI for generating the cli client
 */
@CliCommand()
export class OpenApiClientCommand implements CliCommandShape {
  /** Show Extended Help */
  @CliFlag({ short: '-x' })
  extendedHelp: boolean = false;
  /** Additional Properties */
  @CliFlag({ short: '-a', full: '--additional-properties' })
  properties: string[] = [];
  /** Input file */
  input = './openapi.yml';
  /** Output folder */
  output = './api-client';
  /** Docker Image to user */
  dockerImage = 'openapitools/openapi-generator-cli:latest';

  async help(): Promise<string[]> {
    return OpenApiClientHelp.help(this.dockerImage, this.extendedHelp);
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
      ...(this.properties.length ? ['--additional-properties', this.properties.join(',')] : [])
    ], {
      stdio: 'inherit'
    });

    const result = await ExecUtil.getResult(proc);

    if (!result.valid) {
      process.exitCode = 1;
    }
  }
}