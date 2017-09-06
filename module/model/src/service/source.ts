import { ModelCore, QueryOptions, ModelId } from '../model';
import { Class } from '@encore/schema';
import { BulkState, BulkResponse } from '../model/bulk';
import { Query } from '../model/query';


export abstract class ModelSource {
  abstract getIdField(): string;
  abstract getTypeField(): string;

  abstract prePersist<T>(model: T): Promise<T>;
  abstract postLoad<T>(model: T): T;

  abstract save<T>(cls: Class<T>, model: T): Promise<T>;
  abstract saveAll<T>(cls: Class<T>, models: T[]): Promise<T[]>;
  abstract update<T>(cls: Class<T>, model: T): Promise<T>;
  abstract updateAll<T>(cls: Class<T>, model: T[]): Promise<number>;
  abstract updatePartial<T>(cls: Class<T>, model: Partial<T>): Promise<T>;
  abstract updatePartialByQuery<T>(cls: Class<T>, body: Partial<T>, query: Query<T>): Promise<number>;

  abstract bulkProcess<T>(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse>;
  abstract getById<T>(cls: Class<T>, id: ModelId): Promise<T>;
  abstract getByQuery<T>(cls: Class<T>, query: Query<T>, options?: QueryOptions, failOnMany?: boolean): Promise<T>;
  abstract getAllByQuery<T>(cls: Class<T>, query: Query<T>, options?: QueryOptions): Promise<T[]>;
  abstract getCountByQuery<T>(cls: Class<T>, query: Query<T>): Promise<number>;
  abstract getIdsByQuery<T>(cls: Class<T>, query: Query<T>, options?: QueryOptions): Promise<ModelId>;
  abstract deleteById<T>(cls: Class<T>, id: ModelId): Promise<number>;
  abstract deleteByQuery<T>(cls: Class<T>, query: Query<T>): Promise<number>;

  //  - registerModel(model)
  //  - model setup (e.g.indices)
  //     - foreign keys?

}