import { ModelRegistryIndex, type IndexConfig, type ModelType } from '@travetto/model';
import { RuntimeError, type Class, type Primitive, type ValidFields } from '@travetto/runtime';

type RetainPrimitiveFields<T> = Pick<T, ValidFields<T, Primitive | Date>>;

type IndexClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? IndexClauseRaw<RetainPrimitiveFields<T[P]>> : 1 | -1 | true;
};

export type IndexField<T extends ModelType> = IndexClauseRaw<RetainPrimitiveFields<T>>;

/**
 * Index options
 */
export interface QueryIndexConfig<T extends ModelType> extends IndexConfig<'query'> {
  /**
   * Fields and sort order
   */
  fields: IndexClauseRaw<RetainPrimitiveFields<T>>[];
  /**
   * Is this a unique index
   */
  unique?: boolean;
}

export function QueryIndex<T extends ModelType>(index: Omit<QueryIndexConfig<T>, 'class' | 'type'>) {
  if (index.fields.some(field => field === 'id')) {
    throw new RuntimeError('Cannot create an index with the id field');
  }
  return function (cls: Class<T>): void {
    ModelRegistryIndex.getForRegister(cls).register({ indices: { [index.name]: { ...index, type: 'query', class: cls } } });
  };
}

export const isModelQueryIndex = (idx: unknown): idx is QueryIndexConfig<ModelType> =>
  typeof idx === 'object' && idx !== null && 'type' in idx && typeof idx.type === 'string' && idx.type === 'query';