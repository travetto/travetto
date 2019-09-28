import * as fs from 'fs';
import * as util from 'util';
import { OpenAPIObject } from 'openapi3-ts';

import { FsUtil } from '@travetto/boot';
import { Env } from '@travetto/base';
import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry, RestConfig } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';

import { ApiHostConfig, ApiInfoConfig, SwaggerConfig } from './config';
import { SpecGenerateUtil } from './spec-generate';

const fsWriteFile = util.promisify(fs.writeFile);

@Injectable()
export class SwaggerService {

  @Inject()
  private apiHostConfig: ApiHostConfig;

  @Inject()
  private apiInfoConfig: ApiInfoConfig;

  @Inject()
  private swaggerConfig: SwaggerConfig;

  @Inject()
  private restConfig: RestConfig;

  private spec: OpenAPIObject;

  get generating() {
    return Env.watch;
  }

  async resetSpec() {
    delete this.spec;
    if (this.generating) {
      await this.generate();
    }
  }

  async postConstruct() {
    ControllerRegistry.on(ev => this.resetSpec());
    SchemaRegistry.on(ev => this.resetSpec());

    if (!this.apiHostConfig.servers) {
      this.apiHostConfig.servers = [{ url: this.restConfig.baseUrl }];
    }

    if (this.generating) {
      await FsUtil.mkdirp(this.swaggerConfig.output);
    }

    await this.resetSpec();
  }

  getSpec(): OpenAPIObject {
    if (!this.spec) {
      this.spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...SpecGenerateUtil.generate(this.swaggerConfig),
      };
    }
    return this.spec;
  }

  async generate() {
    const spec = this.getSpec();
    const specFile = FsUtil.joinUnix(this.swaggerConfig.output, 'spec.json');
    console.debug('Generating swagger spec file', specFile);
    await fsWriteFile(specFile, JSON.stringify(spec, undefined, 2));
  }
}