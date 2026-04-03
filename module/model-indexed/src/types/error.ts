import type { ModelType } from '@travetto/model';
import { RuntimeError, type Class } from '@travetto/runtime';

import type { AllIndexes } from './indexes.ts';


export class IndexedFieldError<T extends ModelType> extends RuntimeError {
  constructor(cls: Class<T>, idx: AllIndexes<T>, fieldPath: string, message: string) {
    super(`${message}:  ${idx.name} on ${cls.name} at path ${fieldPath}`, {
      details: { cls: cls.name, index: idx.name, fieldPath }
    });
  }
}
