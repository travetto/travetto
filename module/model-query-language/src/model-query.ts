import { Schema } from '@travetto/schema';
import { PageableModelQuery } from '@travetto/model-query';

import { QueryLanguageParser } from './parser';

const convert = <T>(k?: string, query?: boolean): T | undefined =>
  !k || typeof k !== 'string' ? undefined : (/^[\{\[]/.test(k) ?
    JSON.parse(k) :
    (query ? QueryLanguageParser.parseToQuery(k) : undefined));

@Schema()
export class QueryLanguageModelQuery {
  static finalize<T>(self: QueryLanguageModelQuery): PageableModelQuery<T> {
    return {
      ...(self.limit ? { limit: self.limit } : {}),
      ...(self.offset ? { offset: self.offset } : {}),
      ...(self.sort ? { sort: convert(self.sort) } : {}),
      ...(self.where ? { where: convert(self.where, true) } : {}),
    };
  }

  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}
