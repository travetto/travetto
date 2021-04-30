// @file-if @travetto/model-query
import { Inject } from '@travetto/di';
import { ModelQuerySupport, SortClause, ValidStringFields } from '@travetto/model-query';
import { isQuerySuggestSupported } from '@travetto/model-query/src/internal/service/common';
import { Controller, Get, Path, QuerySchema } from '@travetto/rest';
import { RestModelQuery, RestModelSuggestQuery } from '@travetto/rest/src/extension/model-query';

import { User } from './user';

const convert = <T>(k?: string) => k && typeof k === 'string' && /^[\{\[]/.test(k) ? JSON.parse(k) as T : k;

@Controller('/user')
class UserQueryController {

  @Inject()
  service: ModelQuerySupport;

  @Get('')
  async getAllUser(@QuerySchema() query: RestModelQuery) {
    return this.service.query(User, {
      limit: query.limit,
      offset: query.offset,
      sort: convert(query.sort) as SortClause<User>[],
      where: convert(query.where)
    });
  }

  @Get('/suggest/:field')
  async suggest(@Path() field: ValidStringFields<User>, @QuerySchema() suggest: RestModelSuggestQuery) {
    if (isQuerySuggestSupported(this.service)) {
      return this.service.suggest(User, field, suggest.q, suggest);
    }
  }
}