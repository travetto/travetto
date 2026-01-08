import { Get, Controller, Post, QueryParam, type WebRequest, ContextParam } from '@travetto/web';
import { Integer, Min } from '@travetto/schema';

import type { MockService } from './mock.ts';

@Controller('/simple')
export class Simple {

  service: MockService;

  @ContextParam()
  request: WebRequest;

  constructor(service: MockService) {
    this.service = service;
  }

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

  @Get('img/*')
  async getImage(
    @QueryParam('w') @Integer() @Min(100) width?: number,
    @QueryParam('h') @Integer() @Min(100) height?: number
  ) {
    const img = await this.service.fetchImage(this.request.context.path, { width, height });
    return img;
  }
}