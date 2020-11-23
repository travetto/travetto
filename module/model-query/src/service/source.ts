import { Class } from '@travetto/registry';
import { ModelCrudSupport, ModelType } from '@travetto/model-core';

import { ModelQuery, Query, PageableModelQuery } from '../model/query';

/**
 * Provides all the valid string type fields from a given type T
 */
export type ValidStringFields<T> = {
  [K in keyof T]:
  (T[K] extends (String | string | string[] | String[] | undefined) ? K : never) // eslint-disable-line @typescript-eslint/ban-types
}[keyof T];

/**
 * The contract for a model source
 * @concrete ../internal/service/common:ModelQuerySupportTarget
 */
export interface ModelQuerySupport extends ModelCrudSupport {
  updateAllByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number>;
  updatePartialByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, body: Partial<T>): Promise<T>;
  query<T extends ModelType, U = T>(cls: Class<T>, builder: Query<T>): Promise<U[]>;
  suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]>;
  facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]>;
  suggestEntities<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]>;
  getByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean): Promise<T>;
  getAllByQuery<T extends ModelType>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]>;
  getCountByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number>;
  deleteByQuery<T extends ModelType>(cls: Class<T>, query: ModelQuery<T>): Promise<number>;
}
