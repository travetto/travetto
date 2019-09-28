import { Controller, Get } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { SwaggerService } from './service';

@Controller('/')
export class SwaggerController {

  @Inject()
  service: SwaggerService;

  @Get('/swagger.json')
  async getSpec() {
    return this.service.getSpec();
  }
}