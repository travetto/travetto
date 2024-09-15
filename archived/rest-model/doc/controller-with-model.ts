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
