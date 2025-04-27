import { Schema } from '@travetto/schema';
import { Controller, Post, Body } from '@travetto/web';

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
    const saved = await this.service.update(user);
    return { success: !!saved };
  }
}
