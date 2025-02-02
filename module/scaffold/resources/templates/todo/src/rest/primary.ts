import { Controller, Get, QueryParam } from '@travetto/rest';

@Controller('/')
export class SimpleController {

  @Get('/')
  async hello(@QueryParam() name = 'world'): Promise<{ hello: string }> {
    return { hello: name };
  }
}