import * as commander from 'commander';
import * as path from 'path';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { CliUtil } from '@travetto/cli/src/util';
import { ExecUtil, FsUtil } from '@travetto/boot';

/**
 * CLI for generating the cli client
 */
export class OpenApiClientPlugin extends BasePlugin {
  name = 'openapi:client';

  init(cmd: commander.Command) {
    return cmd
      .arguments('<format> [additional-properties]')
      .option('-i, --input [input]', 'Input file', './openapi.yml')
      .option('-d, --docker-image [docker]', 'Docker Image to use', 'arcsine/openapi-generator:latest')
      .option('-o, --output [output]', 'Output folder', './api-client')
      .option('-w, --watch [watch]', 'Watch for file changes (default: false)', CliUtil.isBoolean);
  }

  async action(format: string, props?: string) {
    this._cmd.input = FsUtil.resolveUnix(this._cmd.input);
    this._cmd.output = FsUtil.resolveUnix(this._cmd.output);

    // Ensure its there
    await FsUtil.mkdirp(this._cmd.output);

    const args = [
      'run',
      '--user', `${process.geteuid()}:${process.getgid()}`,
      '-v', `${this._cmd.output}:/workspace`,
      '-v', `${path.dirname(this._cmd.input)}:/input`,
      '-it',
      '--rm',
      this._cmd.dockerImage,
      'generate',
      '--remove-operation-id-prefix',
      '-g', format,
      '-o', '/workspace',
      '-i', `/input/${path.basename(this._cmd.input)}`,
      ...(this._cmd.watch ? ['-w'] : []),
      ...(props ? ['--additional-properties', props] : [])
    ];

    const { result } = ExecUtil.spawn('docker', args, { stdio: [0, 1, 2] });
    await result.catch(err => process.exit(1));
  }

  complete() {
    return {
      '': ['-i', '--input', '-o', '--output', '-w', '--watch']
    };
  }
}