// @file-if @travetto/schema
import { Schema } from '@travetto/schema';
import { Controller, Post, SchemaBody } from '../../..';

@Schema()
class User {
  name: string;
  age: number;
}

@Controller('/user')
class UserController {

  private service: any;

  @Post('/saveUser')
  async save(@SchemaBody() user: User) {
    user = await this.service.update(user);
    return { success: true };
  }
}
