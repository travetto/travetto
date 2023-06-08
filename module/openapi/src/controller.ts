import { Controller, Get, SetHeaders, Undocumented } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { YamlUtil } from '@travetto/yaml';

import { OpenApiService } from './service';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Method': 'GET',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Credentials': 'true'
};

/**
 * Basic controller for surfacing the api spec
 */
@Undocumented()
@Controller('/')
export class OpenApiController {

  @Inject()
  service: OpenApiService;

  @Get('openapi.json')
  @SetHeaders(CORS_HEADERS)
  async getSpec(): Promise<object> {
    return this.service.getSpec(); // Force output to be simple
  }

  @Get('openapi.yaml')
  @SetHeaders({ 'Content-Type': 'text/vnd.yaml', ...CORS_HEADERS })
  async getYmlSpec(): Promise<string> {
    return YamlUtil.serialize(await this.service.getSpec()); // Force output to be simple
  }
}