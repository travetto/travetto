import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';

import { OpenAPIObject } from 'openapi3-ts';

import { ApiHostConfig, ApiInfoConfig, ApiClientConfig } from './config';
import { SpecGenerateUtil } from './spec-generate';

@Injectable()
export class SwaggerService {

  @Inject()
  private apiHostConfig: ApiHostConfig;

  @Inject()
  private apiInfoConfig: ApiInfoConfig;

  @Inject()
  private apiClientConfig: ApiClientConfig;

  private spec: OpenAPIObject;

  async postConstruct() {
    ControllerRegistry.on(ev => { delete this.spec; });
    SchemaRegistry.on(ev => { delete this.spec; });
  }

  getSpec(): OpenAPIObject {
    if (!this.spec) {
      this.spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...SpecGenerateUtil.generate(this.apiClientConfig),
      };
    }
    return this.spec;
  }
}