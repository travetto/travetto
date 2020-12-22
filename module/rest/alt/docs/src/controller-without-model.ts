// @file-if @travetto/model-core
import { Inject } from '@travetto/di';
import { ModelCrudSupport } from '@travetto/model-core';

import { User } from './user';
import { Path, Controller, SchemaBody, Get, Request, Delete, Post, Put } from '../../..';

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
  async saveUser(@SchemaBody() user: User) {
    return await this.service.create(User, user);
  }

  @Put('')
  async updateUser(@SchemaBody() user: User) {
    return await this.service.update(User, user);
  }
}