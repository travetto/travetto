import * as fs from 'fs';
import * as util from 'util';

import { Env } from '@travetto/base';
import { DockerContainer } from '@travetto/exec';
import { Injectable } from '@travetto/di';
import { FsUtil } from '@travetto/boot';
import { ControllerRegistry } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';

import { ApiClientConfig } from './config';
import { SwaggerService } from './service';

const fsWriteFile = util.promisify(fs.writeFile);

@Injectable()
export class ClientGenerate {

  private running = false;

  codeGenCli: DockerContainer;
  workspace: string;
  internalRoot = '/opt/openapi-generator/modules/openapi-generator-cli/target';

  constructor(private config: ApiClientConfig, private service: SwaggerService) { }

  async init() {
    if (this.codeGenCli) {
      return;
    }

    this.workspace = FsUtil.resolveUnix(this.internalRoot, this.config.output);

    console.info('Running code generator in watch mode', this.config.output);

    await FsUtil.mkdirp(this.config.output);

    this.codeGenCli = new DockerContainer(this.config.codeGenImage)
      .setEntryPoint('/bin/sh')
      .addVolume(FsUtil.resolveUnix(Env.cwd, this.config.output), this.workspace)
      .setInteractive(true)
      .forceDestroyOnShutdown();
  }

  async postConstruct() {
    if (this.config.output && this.config.format && Env.watch) {
      return this.init();
    }
  }

  async start() {
    await this.init();

    if (!this.running) {
      this.running = true;

      await this.codeGenCli.create();
      await this.codeGenCli.start();
    }
  }

  async run() {
    if (this.codeGenCli && !this.running) {

      ControllerRegistry.on(() => setImmediate(() => this.generate(), 1));
      SchemaRegistry.on(() => setImmediate(() => this.generate(), 1));

      this.generate();
    }
  }

  async generate() {
    if (!this.config.format) {
      throw new Error('Output format not set');
    }

    await this.start();

    const spec = this.service.getSpec();
    const specFile = FsUtil.joinUnix(this.config.output, 'spec.json');
    await fsWriteFile(specFile, JSON.stringify(spec, undefined, 2));
    const { result: prom } = await this.codeGenCli.exec([
      'java',
      '-jar', FsUtil.resolveUnix(this.internalRoot, 'openapi-generator-cli.jar'),
      'generate',
      '--remove-operation-id-prefix',
      '-g', this.config.format!,
      '-o', this.workspace,
      '-i', FsUtil.resolveUnix(this.internalRoot, specFile),
      ...(this.config.formatOptions ? ['--additional-properties', this.config.formatOptions] : [])
    ]);
    await prom;
  }
}