import type { OpenAPIObject } from 'openapi3-ts';

import { ManifestUtil } from '@travetto/manifest';
import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry, RestConfig } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';
import { YamlUtil } from '@travetto/yaml';

import { ApiHostConfig, ApiInfoConfig, ApiSpecConfig } from './config';
import { OpenapiVisitor } from './spec-generate';

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
  async resetSpec(): Promise<void> {
    delete this._spec;
    if (this.apiSpecConfig.persist) {
      await this.persist();
    }
  }

  /**
   * Initialize after schemas are readied
   */
  async postConstruct(): Promise<void> {
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
  async getSpec(): Promise<OpenAPIObject> {
    if (!this._spec) {
      this._spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...await ControllerRegistry.visit(new OpenapiVisitor(this.apiSpecConfig))
      };
    }
    return this._spec!;
  }

  /**
   * Persist to local file
   */
  async persist(): Promise<void> {
    try {
      console.debug('Generating OpenAPI Spec', { output: this.apiSpecConfig.output });

      const spec = await this.getSpec();

      const output = this.apiSpecConfig.output.endsWith('.json') ?
        JSON.stringify(spec, undefined, 2) :
        YamlUtil.serialize(spec);

      await ManifestUtil.writeFileWithBuffer(this.apiSpecConfig.output, output);
    } catch (err) {
      console.error('Unable to persist openapi spec', err);
    }
  }
}