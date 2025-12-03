import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { stringify } from 'yaml';

import { BinaryUtil } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistryIndex, ControllerVisitUtil, WebConfig } from '@travetto/web';
import { SchemaRegistryIndex } from '@travetto/schema';
import { Registry } from '@travetto/registry';

import { ApiHostConfig, ApiInfoConfig, ApiSpecConfig } from './config.ts';
import { OpenapiVisitor } from './generate.ts';

/**
 * Open API generation service
 */
@Injectable()
export class OpenApiService {

  @Inject()
  apiHostConfig: ApiHostConfig;

  @Inject()
  apiInfoConfig: ApiInfoConfig;

  @Inject()
  apiSpecConfig: ApiSpecConfig;

  @Inject()
  webConfig: WebConfig;

  #spec: OpenAPIObject | undefined;

  /**
   * Reset specification
   */
  async resetSpec(): Promise<void> {
    this.#spec = undefined;
    if (this.apiSpecConfig.persist) {
      await this.persist();
    }
  }

  /**
   * Initialize after schemas are readied
   */
  async postConstruct(): Promise<void> {
    Registry.onClassChange(() => this.resetSpec(), ControllerRegistryIndex);
    Registry.onClassChange(() => this.resetSpec(), SchemaRegistryIndex);

    if (!this.apiHostConfig.servers && this.webConfig.baseUrl) {
      this.apiHostConfig.servers = [{ url: this.webConfig.baseUrl }];
    }

    await this.resetSpec();
  }

  /**
   * Get specification object
   */
  async getSpec(): Promise<OpenAPIObject> {
    if (!this.#spec) {
      this.#spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...await ControllerVisitUtil.visit(new OpenapiVisitor(this.apiSpecConfig))
      };
    }
    return this.#spec!;
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
    } catch (error) {
      console.error('Unable to persist openapi spec', error);
    }
  }
}