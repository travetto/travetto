import type { OpenAPIObject } from 'openapi3-ts/oas31';

import { BinaryUtil } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry, ControllerVisitUtil, RestConfig } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';
import { stringify } from 'yaml';

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
        ...await ControllerVisitUtil.visit(new OpenapiVisitor(this.apiSpecConfig))
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
        stringify(spec);

      await BinaryUtil.bufferedFileWrite(this.apiSpecConfig.output, output, true);
    } catch (err) {
      console.error('Unable to persist openapi spec', err);
    }
  }
}