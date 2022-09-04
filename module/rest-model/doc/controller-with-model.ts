import { Inject } from '@travetto/di';
import { ModelCrudSupport } from '@travetto/model';
import { Controller, ModelRoutes } from '@travetto/rest';

import { User } from './user';

@Controller('/user')
@ModelRoutes(User)
class UserController {
  @Inject()
  source: ModelCrudSupport;
}
