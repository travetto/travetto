import * as path from 'path';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { ExecUtil, FsUtil, PathUtil } from '@travetto/boot';

/**
 * CLI for generating the cli client
 */
export class OpenApiClientPlugin extends BasePlugin {
  name = 'openapi:client';

  getOptions() {
    return {
      input: this.option({ desc: 'Input file', def: './openapi.yml', combine: v => PathUtil.resolveUnix(v), completion: true }),
      output: this.option({ desc: 'Output folder', def: './api-client', combine: v => PathUtil.resolveUnix(v), completion: true }),
      dockerImage: this.option({ desc: 'Docker Image to use', def: 'arcsine/openapi-generator:latest' }),
      watch: this.boolOption({ desc: 'Watch for file changes' })
    };
  }

  getArgs() {
    return '[format] [additional-properties]';
  }

  async action(format: string, props?: string) {
    // Ensure its there
    await FsUtil.mkdirp(this.cmd.output);

    const args = [
      'run',
      '--user', `${process.geteuid()}:${process.getgid()}`,
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
      ...(props ? ['--additional-properties', props] : [])
    ];

    const { result } = ExecUtil.spawn('docker', args, { stdio: [0, 1, 2] });
    await result.catch(err => process.exit(1));
  }
}