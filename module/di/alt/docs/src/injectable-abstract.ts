import { Injectable } from '../../../src/decorator';

abstract class BaseService {
  abstract work(): Promise<void>;
}

@Injectable()
class SpecificService extends BaseService {
  async work() {
    // Do some additional work
  }
}
