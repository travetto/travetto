import { Controller, Get, QuerySchema } from '@travetto/rest';

type Paging = {
  page?: number;
  pageSize?: number;
};

@Controller('/user')
class UserController {

  private service: {
    search(query: Paging): Promise<number>;
  };

  @Get('/search')
  async search(@QuerySchema() query: Paging = { page: 0, pageSize: 100 }) {
    return await this.service.search(query);
  }
}
