import { Get, Controller, Post, Query, Request } from '@travetto/rest';
import { Integer, Min } from '@travetto/schema';

import { MockService } from './mock';

@Controller('/simple')
export class Simple {

  constructor(private service: MockService) { }

  /**
   * Get a random user by name
   */
  @Get('/name')
  async getName() {
    const user = await this.service.fetch();
    return `/simple/name => ${user.first.toLowerCase()}`;
  }

  /**
   * Get a user by id
   */
  @Get('/:id')
  async getById(id: number) {
    const user = await this.service.fetch(id);
    return `/simple/id => ${user.first.toLowerCase()}`;
  }

  @Post('/name')
  async createName(person: { name: string }) {
    await this.service.update({ name: person.name });
    return { success: true };
  }

  @Get(/\/img(.*)[.](jpg|png|gif)/)
  async getImage(
    req: Request,
    @Query('w') @Integer() @Min(100) width?: number,
    @Query('h') @Integer() @Min(100) height?: number
  ) {
    const img = await this.service.fetchImage(req.path, { width, height });
    return img;
  }
}