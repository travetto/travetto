import { Class, AppError } from '@travetto/runtime';

import { IndexConfig } from '../registry/types.ts';
import { ModelType } from '../types/model.ts';

/**
 * Represents when an index is invalid
 */
export class IndexNotSupported<T extends ModelType> extends AppError {
  constructor(cls: Class<T>, idx: IndexConfig<T>, message: string = '') {
    super(`${typeof cls === 'string' ? cls : cls.name} and index ${idx.name} of type ${idx.type} is not supported. ${message}`.trim(), { category: 'data' });
  }
}