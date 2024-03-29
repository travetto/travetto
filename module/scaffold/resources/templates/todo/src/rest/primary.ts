import { Controller, Get, Query } from '@travetto/rest';

@Controller('/')
export class SimpleController {

  @Get('/')
  async hello(@Query() name = 'world'): Promise<{ hello: string }> {
    return { hello: name };
  }
}