import { Path, Controller, Get, Request, Delete, Post, Put, Query } from '@travetto/rest';
import { Inject } from '@travetto/di';
import { User } from './user';
import { ModelService } from '../../../src/service/model';
import { SchemaBody } from '@travetto/schema';
import { ValidStringFields } from '../../../src/service/source';

@Controller('/user')
class UserController {

  @Inject()
  source: ModelService;

  @Get('')
  async getAllUser(req: Request) {
    return await this.source.getAllByQuery(User, JSON.parse(req.params.q));
  }

  @Get('/suggest/:field')
  async suggest(@Query('q') q: string, @Path('field') field: ValidStringFields<User>) {
    return this.source.suggest(User, field, q);
  }


  @Get(':id')
  async getUser(req: Request) {
    return await this.source.getById(User, req.params.id);
  }

  @Delete(':id')
  async deleteUser(req: Request) {
    return await this.source.deleteById(User, req.params.id);
  }

  @Post('')
  async saveUser(@SchemaBody() user: User) {
    return await this.source.save(User, user);
  }

  @Put('')
  async updateUser(@SchemaBody() user: User) {
    return await this.source.update(User, user);
  }
}