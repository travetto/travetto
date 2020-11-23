import { Path, Controller, Get, Request, Delete, Post, Put, Query } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { SchemaBody } from '@travetto/schema';
import { User } from './user';
import { ModelQuerySupport, ValidStringFields } from '../../../src/service/source';

@Controller('/user')
class UserController {

  @Inject()
  service: ModelQuerySupport;

  @Get('')
  async getAllUser(req: Request) {
    return await this.service.getAllByQuery(User, JSON.parse(req.params.q));
  }

  @Get('/suggest/:field')
  async suggest(@Query('q') q: string, @Path('field') field: ValidStringFields<User>) {
    return this.service.suggest(User, field, q);
  }


  @Get(':id')
  async getUser(req: Request) {
    return await this.service.get(User, req.params.id);
  }

  @Delete(':id')
  async deleteUser(req: Request) {
    return await this.service.delete(User, req.params.id);
  }

  @Post('')
  async saveUser(@SchemaBody() user: User) {
    return await this.service.create(User, user);
  }

  @Put('')
  async updateUser(@SchemaBody() user: User) {
    return await this.service.update(User, user);
  }
}