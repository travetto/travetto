import { createReadStream, existsSync } from 'node:fs';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { stringify } from 'yaml';

import { ManifestFileUtil } from '@travetto/manifest';
import { BinaryMetadataUtil, JSONUtil } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { ControllerVisitUtil, type WebConfig } from '@travetto/web';

import type { ApiHostConfig, ApiInfoConfig, ApiSpecConfig } from './config.ts';
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
        JSONUtil.toUTF8Pretty(spec) :
        stringify(spec);

      if (existsSync(this.apiSpecConfig.output)) {
        const existing = await BinaryMetadataUtil.hash(createReadStream(this.apiSpecConfig.output));
        const toWrite = BinaryMetadataUtil.hash(output);

        if (existing === toWrite) {
          console.debug('OpenAPI spec unchanged, skipping write');
          return;
        }
      }

      await ManifestFileUtil.bufferedFileWrite(this.apiSpecConfig.output, output);
    } catch (error) {
      console.error('Unable to persist openapi spec', error);
    }
  }
}