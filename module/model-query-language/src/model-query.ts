import { Schema } from '@travetto/schema';
import type { PageableModelQuery } from '@travetto/model-query';
import { JSONUtil } from '@travetto/runtime';

import { QueryLanguageParser } from './parser.ts';

const parse = <T>(key: string): T | undefined => !key || typeof key !== 'string' || !/^[\{\[]/.test(key) ? undefined : JSONUtil.fromUTF8(key);

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
