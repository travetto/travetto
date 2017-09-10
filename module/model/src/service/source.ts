import { Class, ChangeEvent } from '@encore2/registry';

import { ModelCore, QueryOptions } from '../model';
import { BulkState, BulkResponse } from '../model/bulk';
import { Query } from '../model/query';


export abstract class ModelSource {
  abstract onChange(e: ChangeEvent): void;

  abstract prePersist<T>(model: Partial<T>): Partial<T>;
  abstract prePersist<T>(model: T): T;

  abstract postLoad<T>(model: Partial<T>): Partial<T>;
  abstract postLoad<T>(model: T): T;

  abstract save<T>(cls: Class<T>, model: T): Promise<T>;
  abstract saveAll<T>(cls: Class<T>, models: T[]): Promise<T[]>;
  abstract update<T>(cls: Class<T>, model: T): Promise<T>;
  abstract updateAll<T>(cls: Class<T>, model: T[]): Promise<number>;
  abstract updatePartial<T>(cls: Class<T>, model: Partial<T>): Promise<T>;
  abstract updatePartialByQuery<T>(cls: Class<T>, body: Partial<T>, query: Query): Promise<number>;

  abstract bulkProcess<T>(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse>;
  abstract getById<T extends { id: ID } = { id: ID }, ID = T['id']>(cls: Class<T>, id: ID): Promise<T>;
  abstract getByQuery<T>(cls: Class<T>, query: Query, options?: QueryOptions, failOnMany?: boolean): Promise<T>;
  abstract getAllByQuery<T>(cls: Class<T>, query: Query, options?: QueryOptions): Promise<T[]>;
  abstract getCountByQuery<T>(cls: Class<T>, query: Query): Promise<number>;
  abstract getIdsByQuery<T extends { id: ID } = { id: ID }, ID = T['id']>(cls: Class<T>, query: Query, options?: QueryOptions): Promise<ID[]>;
  abstract deleteById<T extends { id: ID } = { id: ID }, ID = T['id']>(cls: Class<T>, id: ID): Promise<number>;
  abstract deleteByQuery<T>(cls: Class<T>, query: Query): Promise<number>;

  //  - registerModel(model)
  //  - model setup (e.g.indices)
  //     - foreign keys?

}