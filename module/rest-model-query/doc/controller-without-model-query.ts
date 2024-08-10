import { Inject } from '@travetto/di';
import { ModelQuerySupport, SortClause, ValidStringFields } from '@travetto/model-query';
import { isQuerySuggestSupported } from '@travetto/model-query/src/internal/service/common';
import { Controller, Get } from '@travetto/rest';
import { convertInput, RestModelQuery, RestModelSuggestQuery } from '@travetto/rest-model-query';

import { User } from './user';

@Controller('/user')
class UserQueryController {

  @Inject()
  service: ModelQuerySupport;

  @Get('')
  async getAllUser(query: RestModelQuery) {
    return this.service.query(User, {
      limit: query.limit,
      offset: query.offset,
      sort: convertInput<SortClause<User>[]>(query.sort),
      where: convertInput(query.where, true)
    });
  }

  @Get('/suggest/:field')
  async suggest(field: ValidStringFields<User>, suggest: RestModelSuggestQuery) {
    if (isQuerySuggestSupported(this.service)) {
      return this.service.suggest(User, field, suggest.q, suggest);
    }
  }
}