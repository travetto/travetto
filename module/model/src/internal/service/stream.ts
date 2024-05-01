import { AppError, Class } from '@travetto/base';

import { ModelType } from '../../types/model';

class Cls { id: string; }
export const StreamModel: Class<ModelType> = Cls;
export const STREAMS = '_streams';


/**
 * Enforce byte range for stream stream/file of a certain size
 */
export function enforceRange(start: number, end: number | undefined, size: number): [start: number, end: number] {
  end ??= size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0) {
    throw new AppError('Invalid position, out of range', 'data');
  }
  if (end >= size) {
    end = size - 1;
  }
  return [start, end];
}