import { Inject } from '@travetto/di';

import { ModelController } from '../../../src/extension/rest';
import { ModelService } from '../../../src/service/model';
import { User } from './user';

@ModelController('/user', User)
class UserController {
  @Inject()
  source: ModelService;
}
