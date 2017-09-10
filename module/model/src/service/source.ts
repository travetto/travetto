import { Class, ChangeEvent } from '@encore2/registry';

import { ModelCore, QueryOptions } from '../model';
import { BulkState, BulkResponse } from '../model/bulk';
import { Query } from '../model/query';


export abstract class ModelSource {
  onChange?: (e: ChangeEvent) => void;

  abstract prePersist<T extends ModelCore>(model: Partial<T>): Partial<T>;
  abstract prePersist<T extends ModelCore>(model: T): T;

  abstract postLoad<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Partial<T>;
  abstract postLoad<T extends ModelCore>(cls: Class<T>, model: T): T;

  abstract save<T extends ModelCore>(cls: Class<T>, model: T): Promise<T>;
  abstract saveAll<T extends ModelCore>(cls: Class<T>, models: T[]): Promise<T[]>;
  abstract update<T extends ModelCore>(cls: Class<T>, model: T): Promise<T>;
  abstract updateAll<T extends ModelCore>(cls: Class<T>, model: T[]): Promise<number>;
  abstract updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Promise<T>;
  abstract updatePartialByQuery<T extends ModelCore>(cls: Class<T>, body: Partial<T>, query: Query): Promise<number>;

  abstract bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse>;
  abstract getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T>;
  abstract getByQuery<T extends ModelCore>(cls: Class<T>, query: Query, options?: QueryOptions, failOnMany?: boolean): Promise<T>;
  abstract getAllByQuery<T extends ModelCore>(cls: Class<T>, query: Query, options?: QueryOptions): Promise<T[]>;
  abstract getCountByQuery<T extends ModelCore>(cls: Class<T>, query: Query): Promise<number>;
  abstract getIdsByQuery<T extends ModelCore>(cls: Class<T>, query: Query, options?: QueryOptions): Promise<string[]>;
  abstract deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number>;
  abstract deleteByQuery<T extends ModelCore>(cls: Class<T>, query: Query): Promise<number>;
}