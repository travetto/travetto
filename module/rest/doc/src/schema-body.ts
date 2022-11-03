import { Schema } from '@travetto/schema';
import { Controller, Post, Body } from '@travetto/rest';

@Schema()
class User {
  name: string;
  age: number;
}

@Controller('/user')
class UserController {

  private service: {
    update(user: User): Promise<User>;
  };

  @Post('/saveUser')
  async save(@Body() user: User) {
    user = await this.service.update(user);
    return { success: true };
  }
}
