import { stringify } from 'yaml';

import { ConfigureInterceptor, Controller, CorsInterceptor, Get, SetHeaders, Undocumented } from '@travetto/web';
import { Inject } from '@travetto/di';

import { OpenApiService } from './service.ts';

/**
 * Basic controller for surfacing the api spec
 */
@Undocumented()
@Controller('/')
@ConfigureInterceptor(CorsInterceptor, { origins: ['*'] })
export class OpenApiController {

  @Inject()
  service: OpenApiService;

  @Get('openapi.json')
  async getSpec(): Promise<object> {
    return this.service.getSpec(); // Force output to be simple
  }

  @Get('openapi.yaml')
  @SetHeaders({ 'Content-Type': 'text/vnd.yaml' })
  async getYmlSpec(): Promise<string> {
    return stringify(await this.service.getSpec()); // Force output to be simple
  }
}