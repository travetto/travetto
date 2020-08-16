import { promises as fs } from 'fs';
import { OpenAPIObject } from 'openapi3-ts';

import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry, RestConfig } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';
import { YamlUtil } from '@travetto/yaml';

import { ApiHostConfig, ApiInfoConfig, ApiSpecConfig } from './config';
import { SpecGenerateUtil } from './spec-generate';

/**
 * Open API generation service
 */
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

  private _spec: OpenAPIObject | undefined;

  /**
   * Reset specification
   */
  async resetSpec() {
    delete this._spec;
    if (this.apiSpecConfig.persist) {
      await this.persist();
    }
  }

  /**
   * Initialize after schemas are readied
   */
  async postConstruct() {
    ControllerRegistry.on(() => this.resetSpec());
    SchemaRegistry.on(() => this.resetSpec());

    if (!this.apiHostConfig.servers) {
      this.apiHostConfig.servers = [{ url: this.restConfig.baseUrl }];
    }

    await this.resetSpec();
  }

  /**
   * Get specification object
   */
  get spec(): OpenAPIObject {
    if (!this._spec) {
      this._spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...SpecGenerateUtil.generate(this.apiSpecConfig) as Partial<OpenAPIObject>,
      } as OpenAPIObject;
    }
    return this._spec;
  }

  /**
   * Persist to local file
   */
  async persist() {
    console.debug('Generating OpenAPI spec file', this.apiSpecConfig.output);

    const output = this.apiSpecConfig.output.endsWith('.json') ?
      JSON.stringify(this.spec, undefined, 2) :
      YamlUtil.serialize(this.spec);

    await fs.writeFile(this.apiSpecConfig.output, output);
  }
}