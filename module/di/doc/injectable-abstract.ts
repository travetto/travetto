import { Injectable } from '@travetto/di';

abstract class BaseService {
  abstract work(): Promise<void>;
}

@Injectable()
class SpecificService extends BaseService {
  async work() {
    // Do some additional work
  }
}
