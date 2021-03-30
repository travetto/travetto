import * as commander from 'commander';
import * as path from 'path';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { CliUtil } from '@travetto/cli/src/util';
import { ExecUtil, FsUtil, PathUtil } from '@travetto/boot';

type Config = {
  input: string;
  dockerImage: string;
  output: string;
  watch?: boolean;
};

/**
 * CLI for generating the cli client
 */
export class OpenApiClientPlugin extends BasePlugin<Config> {
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
    this.opts.input = PathUtil.resolveUnix(this.opts.input);
    this.opts.output = PathUtil.resolveUnix(this.opts.output);

    // Ensure its there
    await FsUtil.mkdirp(this.opts.output);

    const args = [
      'run',
      '--user', `${process.geteuid()}:${process.getgid()}`,
      '-v', `${this.opts.output}:/workspace`,
      '-v', `${path.dirname(this.opts.input)}:/input`,
      '-it',
      '--rm',
      this.opts.dockerImage,
      'generate',
      '--skip-validate-spec',
      '--remove-operation-id-prefix',
      '-g', format,
      '-o', '/workspace',
      '-i', `/input/${path.basename(this.opts.input)}`,
      ...(this.opts.watch ? ['-w'] : []),
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