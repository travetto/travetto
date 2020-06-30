// @file-if @travetto/rest
import { Controller, Get } from '@travetto/rest';
import { SchemaQuery } from '../../../src/extension/rest';

type Paging = {
  page?: number;
  pageSize?: number;
};

@Controller('/user')
class UserController {

  private service: any;

  @Get('/search')
  async search(@SchemaQuery() query: Paging = { page: 0, pageSize: 100 }) {
    return await this.service.search(query);
  }
}
