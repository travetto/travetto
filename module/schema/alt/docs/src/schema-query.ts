// @file-if @travetto/rest
import { Controller, Get } from '@travetto/rest';
import { SchemaQuery } from '../../../src/extension/rest';
import { Schema } from '../../../src/decorator/schema';

@Schema()
class SearchParams {
  page: number = 0;
  pageSize: number = 100;
}

@Controller('/user')
class UserController {

  private service: any;

  @Get('/search')
  async search(@SchemaQuery() query: SearchParams) {
    return await this.service.search(query);
  }
}
