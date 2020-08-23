import { Controller, Get, SetHeaders } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { YamlUtil } from '@travetto/yaml';

import { OpenApiService } from './service';

/**
 * Basic controller for surfacing the api spec
 */
@Controller('/')
export class OpenApiController {

  @Inject()
  service: OpenApiService;

  @Get('openapi.json')
  async getSpec() {
    return this.service.spec as object; // Force output to be simple
  }

  @Get(/openapi[.]ya?ml$/)
  @SetHeaders({ 'Content-Type': 'text/vnd.yaml' })
  async getYmlSpec() {
    return YamlUtil.serialize(this.service.spec); // Force output to be simple
  }
}
