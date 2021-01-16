// @file-if @travetto/schema
import { Schema } from '@travetto/schema';
import { Controller, Get, SchemaQuery } from '..';

@Schema()
class SearchParams {
  page: number = 0;
  pageSize: number = 100;
}

@Controller('/user')
class UserController {

  private service: {
    search(query: SearchParams): Promise<number[]>;
  };

  @Get('/search')
  async search(@SchemaQuery() query: SearchParams) {
    return await this.service.search(query);
  }
}
