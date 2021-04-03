// @file-if @travetto/schema
import { Controller, Get, SchemaQuery } from '@travetto/rest';

type Paging = {
  page?: number;
  pageSize?: number;
};

@Controller('/user')
class UserController {

  #service: {
    search(query: Paging): Promise<number>;
  };

  @Get('/search')
  async search(@SchemaQuery() query: Paging = { page: 0, pageSize: 100 }) {
    return await this.#service.search(query);
  }
}
