import { Class, AppError } from '@travetto/base';
import { NotFoundError } from '@travetto/model/src/error/not-found';

/**
 * Common model utils, that should be usable by end users
 */
export class ModelQueryUtil {
  /**
   * Verify result set is singular, and decide if failing on many should happen
   */
  static verifyGetSingleCounts<T>(cls: Class<T>, res?: T[], failOnMany = true) {
    res = res ?? [];
    if (res.length === 1 || res.length > 1 && !failOnMany) {
      return res[0] as T;
    }
    throw res.length === 0 ? new NotFoundError(cls, 'none') : new AppError(`Invalid number of results for find by id: ${res.length}`, 'data');
  }
}