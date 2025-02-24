import { asFull, Class } from '@travetto/runtime';
import { ModelType, OptionalId } from '@travetto/model';

import { ModelQueryCrudSupport } from '@travetto/model-query/src/service/crud.ts';
import { ModelQuerySuggestSupport } from '@travetto/model-query/src/service/suggest.ts';
import { ModelQueryFacetSupport } from '@travetto/model-query/src/service/facet.ts';
import { ValidStringFields } from '@travetto/model-query/src/model/where-clause.ts';
import { ModelQuery, PageableModelQuery } from '@travetto/model-query/src/model/query.ts';
import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud.ts';

export class QueryModelService implements ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySuggestSupport {
  idSource = ModelCrudUtil.uuidSource();
  get client(): unknown {
    return undefined;
  }
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    return asFull({});
  }
  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
  }
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    return asFull({});
  }
  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string | undefined): Promise<T> {
    return asFull({});
  }
  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    return asFull({});
  }
  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    yield* [];
  }
  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    return asFull({});
  }
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    return [];
  }
  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean | undefined): Promise<T> {
    return asFull({});
  }
  async queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return 0;
  }
  async updateByQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T> {
    return asFull({});
  }
  async updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    return 0;
  }
  async deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return 0;
  }
  async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T> | undefined): Promise<{ key: string, count: number }[]> {
    return [];
  }
  async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string | undefined, query?: PageableModelQuery<T> | undefined): Promise<T[]> {
    return [];
  }
  async suggestValues<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string | undefined, query?: PageableModelQuery<T> | undefined): Promise<string[]> {
    return [];
  }
}
