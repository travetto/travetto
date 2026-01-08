import { Injectable, Inject } from '@travetto/di';
import type { DependentService } from './dependency.ts';

@Injectable()
class CustomService {
  @Inject()
  private dependentService: DependentService;

  async coolOperation() {
    await this.dependentService.doWork();
  }
}
