import { Inject } from '@travetto/di';
import { ModelQuerySupport, ValidStringFields } from '@travetto/model-query';
import { isQuerySuggestSupported } from '@travetto/model-query/src/internal/service/common';
import { Controller, Get } from '@travetto/rest';
import { RestModelQuery, RestModelSuggestQuery } from '@travetto/rest-model-query';

import { User } from './user';

@Controller('/user')
class UserQueryController {

  @Inject()
  service: ModelQuerySupport;

  @Get('')
  async getAllUser(query: RestModelQuery) {
    return this.service.query(User, query.finalize());
  }

  @Get('/suggest/:field')
  async suggest(field: ValidStringFields<User>, suggest: RestModelSuggestQuery) {
    if (isQuerySuggestSupported(this.service)) {
      return this.service.suggest(User, field, suggest.q, suggest);
    }
  }
}