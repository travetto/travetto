// @with-module @travetto/model-query
import { Inject } from '@travetto/di';
import { ModelQuerySupport } from '@travetto/model-query';
import { Controller, ModelQueryRoutes } from '@travetto/rest';

import { User } from './user';

@Controller('/user')
@ModelQueryRoutes(User)
class UserQueryController {
  @Inject()
  source: ModelQuerySupport;
}