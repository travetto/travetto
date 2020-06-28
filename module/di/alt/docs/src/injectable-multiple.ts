import { Injectable, Inject } from '../../../src/decorator';

@Injectable()
class CustomService {
  async coolOperation() {
    // do work!
  }
}

const CUSTOM2 = Symbol.for('di-custom2');

@Injectable({ target: CustomService, qualifier: CUSTOM2 })
class CustomService2 extends CustomService {
  async coolOperation() {
    await super.coolOperation();
    // Do some additional work
  }
}

class Consumer {
  @Inject(CUSTOM2) // Pull in specific service
  service: CustomService;
}