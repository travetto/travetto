import { ModelRegistryIndex, type ModelType } from '@travetto/model';
import { RuntimeError, type Class, type Primitive, type ValidFields } from '@travetto/runtime';

type RetainPrimitiveFields<T> = Pick<T, ValidFields<T, Primitive | Date>>;

type IndexClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? IndexClauseRaw<RetainPrimitiveFields<T[P]>> : 1 | -1 | true;
};

export type IndexField<T extends ModelType> = IndexClauseRaw<RetainPrimitiveFields<T>>;

/**
 * Supported index types
 */
export type QueryIndexType = 'unique' | 'unsorted' | 'sorted';

/**
 * Index options
 */
export type QueryIndexConfig<T extends ModelType> = {
  /**
   * Index name
   */
  name: string;
  /**
   * Index simple name, filled out
   */
  simpleName?: string;
  /**
   * Fields and sort order
   */
  fields: IndexClauseRaw<RetainPrimitiveFields<T>>[];
  /**
   * Type
   */
  type: QueryIndexType;
};


/**
 * Defines an index on a model
 * @kind decorator
 */
export function QueryIndex<T extends ModelType>(index: QueryIndexConfig<T>) {
  if (index.fields.some(field => field === 'id')) {
    throw new RuntimeError('Cannot create an index with the id field');
  }
  return function (cls: Class<T>): void {
    ModelRegistryIndex.getForRegister(cls).register({ indices: { [index.name]: index } });
  };
}
