// @file-if @travetto/rest
import { Controller, Post } from '@travetto/rest';
import { SchemaBody } from '../../../src/extension/rest';
import { Schema } from '../../../src/decorator/schema';

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
