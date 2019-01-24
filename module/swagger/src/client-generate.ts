import { DockerContainer } from '@travetto/exec';
import { Injectable } from '@travetto/di';
import { Env, FsUtil } from '@travetto/base';
import { ControllerRegistry } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';

import { ApiClientConfig } from './config';
import { SwaggerService } from './service';

@Injectable()
export class ClientGenerate {

  private running = false;

  codeGenCli: DockerContainer;

  constructor(private config: ApiClientConfig, private service: SwaggerService) { }

  async init() {
    if (this.codeGenCli) {
      return;
    }

    console.info('Running code generator in watch mode', this.config.output);

    await FsUtil.mkdirpAsync(this.config.output);

    this.codeGenCli = new DockerContainer(this.config.codeGenImage)
      .setEntryPoint('/bin/sh')
      .setTTY(true)
      .addVolume(this.config.output, this.config.output)
      .setInteractive(true)
      .forceDestroyOnShutdown();
  }

  async postConstruct() {
    if (this.config.output && this.config.format && Env.watch) {
      return this.init();
    }
  }

  async _start() {
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

    await this._start();

    const spec = this.service.getSpec();
    const specFile = FsUtil.resolveURI(this.config.output, 'spec.json');
    await new Promise((res, rej) => FsUtil.writeFile(specFile, JSON.stringify(spec, undefined, 2), (err) => err ? rej(err) : res()));

    const [, prom] = await this.codeGenCli.exec([], [
      'java',
      '-jar', '/opt/swagger-codegen-cli/swagger-codegen-cli.jar',
      'generate',
      '--remove-operation-id-prefix',
      '-l', this.config.format!,
      '-o', this.config.output,
      '-i', specFile,
      ...(this.config.formatOptions ? ['--additional-properties', this.config.formatOptions] : [])
    ]);

    await prom;
  }
}