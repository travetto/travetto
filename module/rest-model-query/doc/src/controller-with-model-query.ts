import { Inject } from '@travetto/di';
import { ModelQuerySupport } from '@travetto/model-query';
import { Controller } from '@travetto/rest';
import { ModelQueryRoutes } from '@travetto/rest-model-query';

import { User } from './user';

@Controller('/user')
@ModelQueryRoutes(User)
class UserQueryController {
  @Inject()
  source: ModelQuerySupport;
}