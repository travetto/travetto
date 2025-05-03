import { Schema } from '@travetto/schema';
import { PageableModelQuery } from '@travetto/model-query';

import { QueryLanguageParser } from './parser.ts';

const parse = <T>(k: string): T | undefined => !k || typeof k !== 'string' || !/^[\{\[]/.test(k) ? undefined : JSON.parse(k);

@Schema()
export class QueryLanguageModelQuery {
  static finalize<T>(self: QueryLanguageModelQuery): PageableModelQuery<T> {
    return {
      ...(self.limit ? { limit: self.limit } : {}),
      ...(self.offset ? { offset: self.offset } : {}),
      ...(self.sort ? { sort: parse(self.sort) } : {}),
      ...(self.where ? {
        where: parse(self.where) ??
          QueryLanguageParser.parseToQuery(self.where)
      } : {}),
    };
  }

  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}
