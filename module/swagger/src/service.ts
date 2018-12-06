import { Injectable, Inject } from '@travetto/di';
import { ControllerRegistry } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';

import { ApiHostConfig, ApiInfoConfig, ApiClientConfig } from './config';
import { Spec } from './types';
import { SpecGenerateUtil } from './spec-generate';

@Injectable()
export class SwaggerService {

  @Inject()
  private apiHostConfig: ApiHostConfig;

  @Inject()
  private apiInfoConfig: ApiInfoConfig;

  @Inject()
  private apiClientConfig: ApiClientConfig;

  private spec: Spec;

  async postConstruct() {
    ControllerRegistry.on(ev => { delete this.spec; });
    SchemaRegistry.on(ev => { delete this.spec; });
  }

  getSpec(): Spec {
    if (!this.spec) {
      this.spec = {
        ...this.apiHostConfig,
        info: { ...this.apiInfoConfig },
        ...SpecGenerateUtil.generate(this.apiClientConfig),
      } as Spec;
    }
    return this.spec;
  }
}