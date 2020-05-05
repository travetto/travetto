import * as fs from 'fs';
import * as util from 'util';
import { OpenAPIObject } from 'openapi3-ts';

import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry, RestConfig } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';
import { YamlUtil } from '@travetto/yaml';

import { ApiHostConfig, ApiInfoConfig, ApiSpecConfig } from './config';
import { SpecGenerateUtil } from './spec-generate';


const fsWriteFile = util.promisify(fs.writeFile);

@Injectable()
// TODO: Document
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

  async resetSpec() {
    delete this.spec;
    if (this.apiSpecConfig.persist) {
      await this.generate();
    }
  }

  async postConstruct() {
    ControllerRegistry.on(() => this.resetSpec());
    SchemaRegistry.on(() => this.resetSpec());

    if (!this.apiHostConfig.servers) {
      this.apiHostConfig.servers = [{ url: this.restConfig.baseUrl }];
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

    const output = this.apiSpecConfig.output.endsWith('.json') ?
      JSON.stringify(spec, undefined, 2) :
      YamlUtil.serialize(spec);

    await fsWriteFile(this.apiSpecConfig.output, output);
  }
}