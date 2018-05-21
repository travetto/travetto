import { Class, ChangeEvent } from '@travetto/registry';

import { ModelCore, Query, PageableModelQuery } from '../model';
import { BulkState, BulkResponse } from '../model/bulk';
import { ModelQuery } from '../model/query';

export abstract class ModelSource {
  onChange?<T extends ModelCore>(e: ChangeEvent<Class<T>>): void;

  abstract prePersist<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Partial<T>;
  abstract prePersist<T extends ModelCore>(cls: Class<T>, model: T): T;

  abstract postLoad<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Partial<T>;
  abstract postLoad<T extends ModelCore>(cls: Class<T>, model: T): T;

  abstract save<T extends ModelCore>(cls: Class<T>, model: T): Promise<T>;
  abstract saveAll<T extends ModelCore>(cls: Class<T>, models: T[]): Promise<T[]>;
  abstract update<T extends ModelCore>(cls: Class<T>, model: T): Promise<T>;
  abstract updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number>;
  abstract updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Promise<T>;
  abstract updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, body: Partial<T>): Promise<T>;

  abstract query<T extends ModelCore, U = T>(cls: Class<T>, builder: Query<T>): Promise<U[]>;

  abstract bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse>;
  abstract getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T>;
  abstract getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean): Promise<T>;
  abstract getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]>;
  abstract getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number>;
  abstract deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number>;
  abstract deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number>;
}