import { ModelQueryCrudSupport } from '@travetto/model-query/src/service/crud';
import { ModelQuerySuggestSupport } from '@travetto/model-query/src/service/suggest';
import { ModelQueryFacetSupport } from '@travetto/model-query/src/service/facet';
import { ValidStringFields } from '@travetto/model-query/src/model/where-clause';
import { Class } from '@travetto/runtime';
import { ModelType, OptionalId } from '@travetto/model';
import { ModelQuery, PageableModelQuery } from '@travetto/model-query/src/model/query';
import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';

export class QueryModelService implements ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySuggestSupport {
  idSource = ModelCrudUtil.uuidSource();
  get client(): unknown { // @doc-exclude
    return undefined;
  }
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    return {} as T;
  }
  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
  }
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    return {} as T;
  }
  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string | undefined): Promise<T> {
    return {} as T;
  }
  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    return {} as T;
  }
  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    yield* [];
  }
  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    return {} as T;
  }
  async query<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    return [] as T[];
  }
  async queryOne<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean | undefined): Promise<T> {
    return {} as T;
  }
  async queryCount<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return 0;
  }
  async updateOneWithQuery<T extends ModelType>(cls: Class<T>, data: T, query: ModelQuery<T>): Promise<T> {
    return {} as T;
  }
  async updateByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
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
