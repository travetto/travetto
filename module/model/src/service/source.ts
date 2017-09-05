import { ModelCore } from '../model';
import { Class } from '@encore/schema';
import { BulkState, BulkResponse } from '../model/bulk';
import { Query } from '../model/query';

type Id = string | number;

export abstract class ModelSource {
  abstract prePersist<T>(model: T): T;
  abstract postLoad<T>(model: T): T;

  abstract getById<T>(cls: Class<T>, id: Id): Promise<T>;
  abstract deleteById<T>(cls: Class<T>, id: Id): Promise<void>;
  abstract save<T>(model: T): Promise<T>;
  abstract saveAll<T>(models: T[]): Promise<T[]>;
  abstract update<T>(model: T): Promise<T>;
  abstract updateAll<T>(model: T[]): Promise<T[]>;
  abstract partialUpdate<T>(model: T): Promise<T>;
  abstract bulkProcess<T>(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse>;

  abstract getIdsByQuery<T>(cls: Class<T>, query: Query<T>): Promise<Id>;
  abstract getAllByQuery<T>(cls: Class<T>, query: Query<T>): Promise<T[]>;
  abstract getCountByQuery<T>(cls: Class<T>, query: Query<T>): Promise<number>;
  abstract getByQuery<T>(cls: Class<T>, query: Query<T>): Promise<T>;
  abstract deleteByQuery<T>(cls: Class<T>, query: Query<T>): Promise<number>;
  abstract partialUpdateByQuery<T>(cls: Class<T>, body: Partial<T>, query: Query<T>): Promise<number>;

  //  - registerModel(model)
  //  - model setup (e.g.indices)
  //     - foreign keys?

}