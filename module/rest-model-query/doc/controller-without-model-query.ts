import { Inject } from '@travetto/di';
import { ModelQuerySupport, SortClause, ValidStringFields } from '@travetto/model-query';
import { isQuerySuggestSupported } from '@travetto/model-query/src/internal/service/common';
import { Controller, Get } from '@travetto/rest';
import { RestModelQuery, RestModelSuggestQuery } from '@travetto/rest-model-query';
import { QueryLanguageParser } from '@travetto/model-query-language';

import { User } from './user';
const convert = <T>(k?: string): T => !k || typeof k !== 'string' ? undefined : (/^[\{\[]/.test(k) ? JSON.parse(k) : QueryLanguageParser.parseToQuery(k));

@Controller('/user')
class UserQueryController {

  @Inject()
  service: ModelQuerySupport;

  @Get('')
  async getAllUser(query: RestModelQuery) {
    return this.service.query(User, {
      limit: query.limit,
      offset: query.offset,
      sort: convert<SortClause<User>[]>(query.sort),
      where: convert(query.where)
    });
  }

  @Get('/suggest/:field')
  async suggest(field: ValidStringFields<User>, suggest: RestModelSuggestQuery) {
    if (isQuerySuggestSupported(this.service)) {
      return this.service.suggest(User, field, suggest.q, suggest);
    }
  }
}