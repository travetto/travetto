import { Class } from '@encore2/registry';

import { ModelCore, QueryOptions } from '../model';
import { BulkState, BulkResponse } from '../model/bulk';
import { Query } from '../model/query';


export abstract class ModelSource<T, ID = string> {
  abstract getIdField(): string;
  abstract getTypeField(): string;

  abstract prePersist(model: T): T;
  abstract postLoad(model: T): T;

  abstract save(cls: Class<T>, model: T): Promise<T>;
  abstract saveAll(cls: Class<T>, models: T[]): Promise<T[]>;
  abstract update(cls: Class<T>, model: T): Promise<T>;
  abstract updateAll(cls: Class<T>, model: T[]): Promise<number>;
  abstract updatePartial(cls: Class<T>, model: Partial<T>): Promise<T>;
  abstract updatePartialByQuery(cls: Class<T>, body: Partial<T>, query: Query): Promise<number>;

  abstract bulkProcess(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse>;
  abstract getById(cls: Class<T>, id: ID): Promise<T>;
  abstract getByQuery(cls: Class<T>, query: Query, options?: QueryOptions, failOnMany?: boolean): Promise<T>;
  abstract getAllByQuery(cls: Class<T>, query: Query, options?: QueryOptions): Promise<T[]>;
  abstract getCountByQuery(cls: Class<T>, query: Query): Promise<number>;
  abstract getIdsByQuery(cls: Class<T>, query: Query, options?: QueryOptions): Promise<ID[]>;
  abstract deleteById(cls: Class<T>, id: ID): Promise<number>;
  abstract deleteByQuery(cls: Class<T>, query: Query): Promise<number>;

  //  - registerModel(model)
  //  - model setup (e.g.indices)
  //     - foreign keys?

}