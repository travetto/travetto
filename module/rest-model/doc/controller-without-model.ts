import { Inject } from '@travetto/di';
import { ModelCrudSupport } from '@travetto/model';
import { Path, Controller, Body, Get, Request, Delete, Post, Put } from '@travetto/rest';

import { User } from './user';

@Controller('/user')
class UserController {

  @Inject()
  service: ModelCrudSupport;

  @Get('')
  async getAllUser(req: Request) {
    return await this.service.list(User);
  }

  @Get(':id')
  async getUser(@Path() id: string) {
    return await this.service.get(User, id);
  }

  @Delete(':id')
  async deleteUser(@Path() id: string) {
    return await this.service.delete(User, id);
  }

  @Post('')
  async saveUser(@Body() user: User) {
    return await this.service.create(User, user);
  }

  @Put('')
  async updateUser(@Body() user: User) {
    return await this.service.update(User, user);
  }
}