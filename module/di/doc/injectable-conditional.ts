import { Env } from '@travetto/base';
import { Inject, Injectable } from '@travetto/di';

@Injectable({ enabled: Env.production })
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
    // Only injected when available, in prod
    this.logger?.log();
    // Do work
  }
}