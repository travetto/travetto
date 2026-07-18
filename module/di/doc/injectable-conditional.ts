import { Inject, Injectable } from '@travetto/di';
import { Runtime } from '@travetto/runtime';

@Injectable({ enabled: Runtime.production })
class ProductionLogger {
  async log() {
    console.log('This will only run in production');
  }
}

@Injectable()
class RuntimeService {
  @Inject()
  logger?: ProductionLogger;

  action(): void {
    // Only injected when available, in production
    this.logger?.log();
    // Do work
  }
}
