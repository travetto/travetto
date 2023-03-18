import fs from 'fs/promises';
import type { OpenAPIObject } from 'openapi3-ts';

import { path } from '@travetto/manifest';
import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry, RestConfig } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';
import { YamlUtil } from '@travetto/yaml';

import { ApiHostConfig, ApiInfoConfig, ApiSpecConfig } from './config';
import { SpecGenerator } from './spec-generate';

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
  get spec(): OpenAPIObject {
    if (!this._spec) {
      this._spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...new SpecGenerator().generate(this.apiSpecConfig)
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

      const output = this.apiSpecConfig.output.endsWith('.json') ?
        JSON.stringify(this.spec, undefined, 2) :
        YamlUtil.serialize(this.spec);

      // TODO: Should use file abstraction
      await fs.mkdir(path.dirname(this.apiSpecConfig.output), { recursive: true });
      await fs.writeFile(this.apiSpecConfig.output, output);
    } catch (err) {
      console.error('Unable to persist openapi spec', err);
    }
  }
}