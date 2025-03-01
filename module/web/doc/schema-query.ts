import { Schema } from '@travetto/schema';
import { Controller, Get } from '@travetto/web';

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
  async search(query: SearchParams) {
    return await this.service.search(query);
  }
}
