import { Controller, Get } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { SwaggerService } from './service';
import { ClientGenerate } from './client-generate';

@Controller('/')
export class SwaggerController {

  @Inject()
  service: SwaggerService;

  @Inject()
  generator: ClientGenerate;

  postConstruct() {
    return this.generator.run();
  }

  @Get('/swagger.json')
  async getSpec() {
    return this.service.getSpec();
  }
}