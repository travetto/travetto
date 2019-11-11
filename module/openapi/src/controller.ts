import { Controller, Get } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { OpenApiService } from './service';

@Controller('/')
export class OpenApiController {

  @Inject()
  service: OpenApiService;

  @Get('/openapi.json')
  async getSpec() {
    return this.service.getSpec();
  }
}