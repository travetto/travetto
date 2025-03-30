import { Injectable, Inject } from '@travetto/di';

@Injectable()
class CustomService {
  async coolOperation() {
    // do work!
  }
}

const Custom2Symbol = Symbol.for('di-custom2');

@Injectable({ target: CustomService, qualifier: Custom2Symbol })
class CustomService2 extends CustomService {
  override async coolOperation() {
    await super.coolOperation();
    // Do some additional work
  }
}

class Consumer {
  @Inject(Custom2Symbol) // Pull in specific service
  service: CustomService;
}