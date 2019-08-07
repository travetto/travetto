import { Class } from '@travetto/registry';
import { AppError } from '@travetto/base';

export class ModelUtil {
  static verifyGetSingleCounts<T>(cls: Class<T>, res?: T[], failOnMany = true) {
    res = res || [];
    if (res.length === 1 || res.length > 1 && !failOnMany) {
      return res[0] as T;
    }
    throw new AppError(`Invalid number of results for find by id: ${res.length}`, res.length < 1 ? 'notfound' : 'data');
  }
}