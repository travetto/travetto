// @file-if @travetto/model-core
import { Inject } from '@travetto/di';
import { ModelCrudSupport } from '@travetto/model-core';

import { ModelController } from '../../../src/extension/model';
import { User } from './user';

@ModelController('/user', User)
class UserController {
  @Inject()
  source: ModelCrudSupport;
}
