import { AppError, Class } from '@travetto/base';

import { ModelType } from '../../types/model';
import { StreamRange } from '../../service/stream';

class Cls { id: string; }
export const StreamModel: Class<ModelType> = Cls;
export const STREAMS = '_streams';


/**
 * Enforce byte range for stream stream/file of a certain size
 */
export function enforceRange({ start, end }: StreamRange, size: number): Required<StreamRange> {
  end = Math.min(end ?? size - 1, size - 1);

  if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
    throw new AppError('Invalid position, out of range', 'data');
  }

  return { start, end };
}