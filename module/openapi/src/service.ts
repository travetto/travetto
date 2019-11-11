import * as fs from 'fs';
import * as util from 'util';
import { OpenAPIObject } from 'openapi3-ts';

import { FsUtil } from '@travetto/boot';
import { Env } from '@travetto/base';
import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry, RestConfig } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';

import { ApiHostConfig, ApiInfoConfig, ApiSpecConfig } from './config';
import { SpecGenerateUtil } from './spec-generate';

const fsWriteFile = util.promisify(fs.writeFile);

@Injectable()
export class OpenApiService {

  @Inject()
  private apiHostConfig: ApiHostConfig;

  @Inject()
  private apiInfoConfig: ApiInfoConfig;

  @Inject()
  private apiSpecConfig: ApiSpecConfig;

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
      await FsUtil.mkdirp(this.apiSpecConfig.output);
    }

    await this.resetSpec();
  }

  getSpec(): OpenAPIObject {
    if (!this.spec) {
      this.spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...SpecGenerateUtil.generate(this.apiSpecConfig),
      };
    }
    return this.spec;
  }

  async generate() {
    const spec = this.getSpec();
    console.debug('Generating OpenAPI spec file', this.apiSpecConfig.output);
    await fsWriteFile(this.apiSpecConfig.output, JSON.stringify(spec, undefined, 2));
  }
}