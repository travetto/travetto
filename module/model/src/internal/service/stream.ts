import { AppError, Class } from '@travetto/base';
import { ModelType } from '../../types/model';

class Cls { id: string; }
export const StreamModel: Class<ModelType> = Cls;
export const STREAMS = '_streams';

export class ModelStreamUtil {
  static checkRange(start: number, end: number, size: number): void {
    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start < 0 || end >= size) {
      throw new AppError('Invalid position, out of range', 'data');
    }
  }
}