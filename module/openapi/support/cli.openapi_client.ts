import path from 'node:path';
import cp from 'node:child_process';

import { type CliCommandShape, CliCommand, CliFlag } from '@travetto/cli';
import { ExecUtil } from '@travetto/runtime';

import { OpenApiClientHelp } from './bin/help.ts';

/**
 * Generate API clients from an OpenAPI specification using the generator image.
 *
 * This command wraps OpenAPI Generator in Docker and writes generated client code
 * into the configured output folder.
 */
@CliCommand()
export class OpenApiClientCommand implements CliCommandShape {
  /** Show expanded generator help for all available formats/options. */
  @CliFlag({ short: '-x' })
  extendedHelp: boolean = false;
  /** Additional generator properties passed as comma-separated key/value pairs. */
  @CliFlag({ short: '-a', full: '--additional-properties' })
  properties: string[] = [];
  /** Input OpenAPI document path. */
  input = './openapi.yml';
  /** Output directory for generated client sources. */
  output = './api-client';
  /** Docker image used to run OpenAPI Generator. */
  dockerImage = 'openapitools/openapi-generator-cli:latest';

  async help(): Promise<string[]> {
    return OpenApiClientHelp.help(this.dockerImage, this.extendedHelp);
  }

  async main(format: string): Promise<void> {
    this.output = path.resolve(this.output);
    this.input = path.resolve(this.input);

    const subProcess = cp.spawn(
      'docker',
      [
        'run',
        '--rm',
        '-i',
        '-v',
        `${this.output}:/workspace`,
        '-v',
        `${path.dirname(this.input)}:/input`,
        '--user',
        `${process.geteuid?.() ?? 0}:${process.getgid?.() ?? 0}`,
        this.dockerImage,
        // Parameters
        'generate',
        '--skip-validate-spec',
        '--remove-operation-id-prefix',
        '-g',
        format,
        '-o',
        '/workspace',
        '-i',
        `/input/${path.basename(this.input)}`,
        ...(this.properties.length ? ['--additional-properties', this.properties.join(',')] : [])
      ],
      {
        stdio: 'inherit'
      }
    );

    const result = await ExecUtil.getResult(subProcess);

    if (!result.valid) {
      process.exitCode = 1;
    }
  }
}
