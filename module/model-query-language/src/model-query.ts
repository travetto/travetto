import { Schema } from '@travetto/schema';
import { PageableModelQuery } from '@travetto/model-query';

import { QueryLanguageParser } from './parser';

const convert = <T>(k?: string, query?: boolean): T | undefined =>
  !k || typeof k !== 'string' ? undefined : (/^[\{\[]/.test(k) ? JSON.parse(k) : (query ? QueryLanguageParser.parseToQuery(k) : undefined));


@Schema()
export class ModelQueryLanguageQuery {
  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;

  finalize<T>(): PageableModelQuery<T> {
    return {
      ...(this.limit ? { limit: this.limit } : {}),
      ...(this.offset ? { offset: this.offset } : {}),
      ...(this.sort ? { sort: convert(this.sort) } : {}),
      ...(this.where ? { where: convert(this.where, true) } : {}),
    };
  }
}
