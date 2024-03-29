<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/rest-model/DOC.tsx and execute "npx trv doc" to rebuild -->
# RESTful Model Routes

## RESTful support for generating APIs from Model classes.

**Install: @travetto/rest-model**
```bash
npm install @travetto/rest-model

# or

yarn add @travetto/rest-model
```

To facilitate common RESTful patterns, the module exposes  [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations.") support in the form of [ModelRoutes](https://github.com/travetto/travetto/tree/main/module/rest-model/src/model.ts#L16).

**Code: ModelRoutes example**
```typescript
import { Inject } from '@travetto/di';
import { ModelCrudSupport } from '@travetto/model';
import { Controller } from '@travetto/rest';
import { ModelRoutes } from '@travetto/rest-model';

import { User } from './user';

@Controller('/user')
@ModelRoutes(User)
class UserController {
  @Inject()
  source: ModelCrudSupport;
}
```

is a shorthand that is equal to:

**Code: Comparable UserController, built manually**
```typescript
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
```
