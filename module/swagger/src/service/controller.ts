import { Controller, Options, Get, Cors } from '@travetto/rest';
import { Inject } from '@travetto/di';

import { SwaggerService } from '../service';
import { ClientGenerate } from './client-generate';

@Cors()
@Controller('/')
export class SwaggerController {

  @Inject()
  service: SwaggerService;

  @Inject()
  generator: ClientGenerate;

  postConstruct() {
    this.generator.run();
  }

  @Options('/swagger.json')
  async getSpecOptions() { }

  @Get('/swagger.json')
  async getSpec() {
    return this.service.getSpec();
  }
}