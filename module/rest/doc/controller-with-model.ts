// @file-if @travetto/model
import { Inject } from '@travetto/di';
import { ModelCrudSupport } from '@travetto/model';
import { ModelController } from '@travetto/rest';

import { User } from './user';

@ModelController('/user', User)
class UserController {
  @Inject()
  source: ModelCrudSupport;
}
